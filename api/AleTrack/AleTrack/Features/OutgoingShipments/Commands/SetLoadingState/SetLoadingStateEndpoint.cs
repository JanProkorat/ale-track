using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.SetLoadingState;

/// <summary>
/// How far a product has got through loading in one invoice column.
/// </summary>
public sealed record SetLoadingStateDto
{
    /// <summary>
    /// Public ID of the product.
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Which invoice column, by position within the shipment. 1 is the remainder column.
    /// </summary>
    public int Sequence { get; set; }

    /// <summary>
    /// The new state. <see cref="ShipmentLoadingState.NotLoaded"/> clears it.
    /// </summary>
    public ShipmentLoadingState State { get; set; }
}

/// <summary>
/// Request to set a loading state on an outgoing shipment.
/// </summary>
public sealed record SetLoadingStateRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Product, column and state.
    /// </summary>
    [FromBody]
    public SetLoadingStateDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="SetLoadingStateRequest"/>.
/// </summary>
public sealed class SetLoadingStateValidator : Validator<SetLoadingStateRequest>
{
    public SetLoadingStateValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data.ProductId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data.Sequence)
            .GreaterThanOrEqualTo(1)
            .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
        RuleFor(r => r.Data.State).IsInEnum().WithErrorCode(ErrorCodes.ValidationEnumError);
    }
}

/// <summary>
/// Endpoint recording how far a product has got through loading in one invoice column.
/// </summary>
/// <remarks>
/// Only states past <see cref="ShipmentLoadingState.NotLoaded"/> are stored; clearing one deletes
/// the row, the same "store only exceptions" rule the purchase split follows.
///
/// The order items' own <c>IsShipmentLoadingConfirmed</c> flag is derived from these rather than
/// set by hand: an item counts as loaded once every column carrying its product has been at least
/// dictated. Other screens (the order detail) read that flag and keep working unchanged.
/// </remarks>
/// <param name="dbContext"></param>
public sealed class SetLoadingStateEndpoint(AleTrackDbContext dbContext) : Endpoint<SetLoadingStateRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/loading-states");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetLoadingStateEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets how far a product has got through loading in one invoice column";
                s.Responses[StatusCodes.Status204NoContent] = "State stored";
                s.Responses[StatusCodes.Status400BadRequest] = "Shipment no longer editable";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment or product not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetLoadingStateRequest req, CancellationToken ct)
    {
        var shipment = await dbContext.OutgoingShipments
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.OrderItems)
            .Include(s => s.StockPurchases)
            .Include(s => s.PurchaseInvoices).ThenInclude(i => i.Lines)
            .Include(s => s.LoadingStates)
            .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

        if (shipment is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return;
        }

        if (!PurchaseInvoiceSplit.IsEditable(shipment))
        {
            ThrowHelper.BadRequest($"Loading of a {shipment.State} shipment can no longer be changed.");
            return;
        }

        var product = await dbContext.Products.FirstOrDefaultAsync(p => p.PublicId == req.Data.ProductId, ct);
        if (product is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Product), req.Data.ProductId);
            return;
        }

        var pieces = PurchaseInvoiceSplit.PiecesByColumn(shipment, product.Id);
        if (!pieces.TryGetValue(req.Data.Sequence, out var inColumn) || inColumn <= 0)
        {
            ThrowHelper.BadRequest($"Column {req.Data.Sequence} carries no pieces of this product.");
            return;
        }

        var existing = shipment.LoadingStates
            .FirstOrDefault(s => s.ProductId == product.Id && s.Sequence == req.Data.Sequence);

        if (req.Data.State == ShipmentLoadingState.NotLoaded)
        {
            if (existing is not null)
            {
                shipment.LoadingStates.Remove(existing);
                dbContext.OutgoingShipmentLoadingStates.Remove(existing);
            }
        }
        else if (existing is null)
        {
            shipment.LoadingStates.Add(new OutgoingShipmentLoadingState
            {
                PublicId = Guid.NewGuid(),
                OutgoingShipment = shipment,
                ProductId = product.Id,
                Sequence = req.Data.Sequence,
                State = req.Data.State
            });
        }
        else
        {
            existing.State = req.Data.State;
        }

        DeriveItemConfirmation(shipment, product.Id);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Keeps the order items' loading flag in step: confirmed once every column carrying the
    /// product has been dictated at least.
    /// </summary>
    private static void DeriveItemConfirmation(OutgoingShipment shipment, long productId)
    {
        var columnsWithPieces = PurchaseInvoiceSplit.PiecesByColumn(shipment, productId)
            .Where(c => c.Value > 0)
            .Select(c => c.Key)
            .ToList();

        var confirmed = columnsWithPieces.Count > 0 && columnsWithPieces.All(sequence =>
            shipment.LoadingStates.Any(s =>
                s.ProductId == productId && s.Sequence == sequence && s.State != ShipmentLoadingState.NotLoaded));

        foreach (var item in shipment.Stops
                     .Where(s => s.ClientOrder is not null)
                     .SelectMany(s => s.ClientOrder!.OrderItems)
                     .Where(i => i.ProductId == productId))
        {
            item.IsShipmentLoadingConfirmed = confirmed;
        }

        foreach (var purchase in shipment.StockPurchases.Where(p => p.ProductId == productId))
            purchase.IsShipmentLoadingConfirmed = confirmed;
    }
}
