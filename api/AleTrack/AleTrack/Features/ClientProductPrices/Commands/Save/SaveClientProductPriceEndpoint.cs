using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientProductPrices.Commands.Save;

/// <summary>
/// Request to set the price a client pays for one product.
/// </summary>
public sealed record SaveClientProductPriceRequest
{
    /// <summary>Public ID of the client</summary>
    public Guid ClientId { get; set; }

    /// <summary>Public ID of the product</summary>
    public Guid ProductId { get; set; }

    /// <summary>Body of the request</summary>
    [FromBody]
    public SaveClientProductPriceDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint setting the price a client pays for one product.
/// </summary>
/// <remarks>
/// An upsert on the compound (client, product) route rather than a write against the row's
/// own public id, which is how <c>ClientDeliveryPlaces</c> does it: there the row's <c>PublicId</c>
/// already exists before any edit, but here the (client, product) pair *is* the key, and an
/// upsert has no row id to address before the row exists.
///
/// Known, accepted race: the create path is check-then-act — it reads <c>existing</c>, then
/// <c>Add</c>s when it is null. Two concurrent first-time PUTs for the same (client, product) can
/// both observe a null <c>existing</c> and both attempt to insert; the loser's <c>SaveChangesAsync</c>
/// surfaces the table's unique index on (client_id, product_id) as an unhandled 500 rather than an
/// idempotent 204. This is accepted, not fixed: the unique index is the backstop, so data integrity
/// is never at risk, and every other create endpoint in this codebase follows the same check-then-act
/// shape without a transaction or retry around it.
/// </remarks>
internal sealed class SaveClientProductPriceEndpoint(AleTrackDbContext dbContext, TimeProvider timeProvider)
    : Endpoint<SaveClientProductPriceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/{clientId:guid}/product-prices/{productId:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .WithName(nameof(SaveClientProductPriceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status204NoContent));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Sets the price a client pays for one product";
            s.Responses[StatusCodes.Status204NoContent] = "Price saved";
            s.Responses[StatusCodes.Status404NotFound] = "Client or product not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SaveClientProductPriceRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PublicId == req.ClientId && !c.IsDeleted, ct);

        if (client is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.ClientId);
        }

        var product = await dbContext.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.PublicId == req.ProductId && !p.IsDeleted, ct);

        if (product is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Product), req.ProductId);
        }

        var existing = await dbContext.ClientProductPrices
            .FirstOrDefaultAsync(p => p.ClientId == client!.Id && p.ProductId == product!.Id, ct);

        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);

        if (existing is null)
        {
            dbContext.ClientProductPrices.Add(new ClientProductPrice
            {
                PublicId = Guid.NewGuid(),
                ClientId = client!.Id,
                ProductId = product!.Id,
                PriceWithVat = req.Data.PriceWithVat,
                SetOn = today
            });
        }
        else
        {
            existing.PriceWithVat = req.Data.PriceWithVat;
            existing.SetOn = today;
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
