using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Clients.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Client = AleTrack.Entities.Client;
using Order = AleTrack.Entities.Order;

namespace AleTrack.Features.Clients.Commands.Ledger.Save;

/// <summary>
/// Request to record a batch of deviations for one client.
/// </summary>
public sealed record SaveClientLedgerEntriesRequest
{
    /// <summary>Public ID of the client the deviations belong to.</summary>
    public Guid Id { get; set; }

    /// <summary>Body of the request.</summary>
    [FromBody]
    public SaveClientLedgerEntriesDto Data { get; set; } = null!;
}

/// <summary>
/// Records what happened differently on a handover.
/// </summary>
/// <remarks>
/// An upsert, not an insert. Reopening the form must show — and re-saving must overwrite — the
/// stored reality, or the second save records the difference a second time and the debt doubles.
/// See <see cref="ClientLedgerWriter"/>; the partial unique index behind it is what makes the
/// invariant unraceable.
///
/// It deliberately does not go through <c>UpdateOrderEndpoint</c>: the ledger is a record beside
/// the order, so the frozen-content guarantee is untouched and the papers printed before the run
/// stay true.
/// </remarks>
public sealed class SaveClientLedgerEntriesEndpoint(AleTrackDbContext dbContext, IAppContext appContext)
    : Endpoint<SaveClientLedgerEntriesRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("clients/{id}/ledger-entries");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SaveClientLedgerEntriesEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Records deviations from the plan for a client";
            s.Responses[StatusCodes.Status204NoContent] = "Deviations recorded";
            s.Responses[StatusCodes.Status400BadRequest] = "The order belongs to another client";
            s.Responses[StatusCodes.Status404NotFound] = "Client, order or line not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SaveClientLedgerEntriesRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients.FirstOrDefaultAsync(c => c.PublicId == req.Id, ct);
        if (client is null)
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.Id);

        var order = await LoadOrderAsync(req.Data.OrderId, client!, ct);

        // Derived from the order rather than posted: an order sits on at most one stop, so a
        // posted stop could only ever agree with this one or be wrong.
        var scope = new ClientLedgerScope(client!.Id, order?.Id, order?.OutgoingShipmentStop?.Id);

        // Only unresolved entries of the same provenance may be rewritten. A settled entry is
        // history and gets a new row beside it.
        var openEntries = await dbContext.ClientLedgerEntries
            .Where(e => e.ClientId == client.Id && e.ResolvedAt == null && e.OrderId == scope.OrderId)
            .ToListAsync(ct);

        var userId = await ResolveCurrentUserIdAsync(ct);
        var now = DateTime.UtcNow;

        foreach (var row in req.Data.Rows)
        {
            var line = await ResolveLineAsync(row, order, ct);
            ClientLedgerWriter.Upsert(dbContext, openEntries, scope, line, userId, now);
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Loads the order the deviations came off, with everything a posted row can point at.
    /// </summary>
    private async Task<Order?> LoadOrderAsync(Guid? orderPublicId, Client client, CancellationToken ct)
    {
        if (orderPublicId is null)
            return null;

        var order = await dbContext.Orders
            .Include(o => o.Client)
            .Include(o => o.OrderItems)
                .ThenInclude(i => i.Product)
            .Include(o => o.Returns)
            .Include(o => o.CustomExtraItems)
            .Include(o => o.SupplierGoodItems)
            .Include(o => o.OutgoingShipmentStop)
            .FirstOrDefaultAsync(o => o.PublicId == orderPublicId, ct);

        if (order is null)
            ThrowHelper.PublicEntityNotFound(nameof(Order), orderPublicId.Value);

        if (order!.ClientId != client.Id && order.Client?.Id != client.Id)
            ThrowHelper.BadRequest($"Order {orderPublicId} does not belong to client {client.PublicId}.");

        return order;
    }

    /// <summary>
    /// Turns a posted row's public ids into the internal ones the writer pairs on, and snapshots
    /// the product name so the entry stays readable after the product is retired.
    /// </summary>
    /// <remarks>
    /// Lines are resolved off the order rather than looked up globally, so a row can only ever
    /// point at a line of the delivery it claims to be about.
    /// </remarks>
    private async Task<ClientLedgerLine> ResolveLineAsync(ClientLedgerRowDto row, Order? order, CancellationToken ct)
    {
        var orderItem = Find(order?.OrderItems, row.OrderItemId, i => i.PublicId, nameof(OrderItem));
        var supplierGoodItem = Find(order?.SupplierGoodItems, row.SupplierGoodItemId, i => i.PublicId, nameof(OrderSupplierGoodItem));
        var customExtraItem = Find(order?.CustomExtraItems, row.CustomExtraItemId, i => i.PublicId, nameof(OrderCustomExtraItem));
        var orderReturn = Find(order?.Returns, row.OrderReturnId, r => r.PublicId, nameof(OrderReturn));

        // The product is looked up on its own only for something taken at the door: that has no
        // order line, so the product is the only thing identifying it.
        var product = orderItem?.Product;
        if (product is null && row.ProductId is not null)
        {
            product = await dbContext.Products.FirstOrDefaultAsync(p => p.PublicId == row.ProductId, ct);
            if (product is null)
                ThrowHelper.PublicEntityNotFound(nameof(Product), row.ProductId.Value);
        }

        return new ClientLedgerLine
        {
            Target = row.Target,
            OrderItemId = orderItem?.Id,
            ProductId = product?.Id,
            ProductName = product?.Name,
            SupplierGoodItemId = supplierGoodItem?.Id,
            CustomExtraItemId = customExtraItem?.Id,
            OrderReturnId = orderReturn?.Id,
            LineName = row.LineName,
            PlannedQuantity = row.PlannedQuantity,
            ActualQuantity = row.ActualQuantity,
            PlannedText = row.PlannedText,
            ActualText = row.ActualText,
            Amount = row.Amount,
            Note = row.Note
        };
    }

    /// <summary>
    /// Resolves one posted line id against the order's own collection, or 404s.
    /// </summary>
    private static T? Find<T>(
        IEnumerable<T>? candidates,
        Guid? publicId,
        Func<T, Guid> publicIdOf,
        string entityName)
        where T : class
    {
        if (publicId is null)
            return null;

        var found = candidates?.FirstOrDefault(c => publicIdOf(c) == publicId.Value);
        if (found is null)
            ThrowHelper.PublicEntityNotFound(entityName, publicId.Value);

        return found;
    }

    private async Task<long?> ResolveCurrentUserIdAsync(CancellationToken ct)
    {
        if (appContext.UserId is null)
            return null;

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.PublicId == appContext.UserId, ct);

        return user?.Id;
    }
}
