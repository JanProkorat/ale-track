using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.SetOrderItemSourcing;

/// <summary>
/// How many of one order line's pieces come off our own shelf instead of the brewery's pallet.
/// </summary>
public sealed record SetOrderItemSourcingDto
{
    /// <summary>
    /// Pieces taken from stock. Zero clears the sourcing.
    /// </summary>
    public int QuantityFromInventory { get; set; }

    /// <summary>
    /// Public ID of the stock entry they come from. Required when
    /// <see cref="QuantityFromInventory"/> is above zero, ignored otherwise.
    /// </summary>
    public Guid? InventoryItemId { get; set; }
}

/// <summary>
/// Request to set one order line's inventory sourcing on a shipment.
/// </summary>
public sealed record SetOrderItemSourcingRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Public ID of the order item being sourced.
    /// </summary>
    public Guid OrderItemId { get; set; }

    /// <summary>
    /// Quantity and the stock entry it comes from.
    /// </summary>
    [FromBody]
    public SetOrderItemSourcingDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="SetOrderItemSourcingRequest"/>.
/// </summary>
public sealed class SetOrderItemSourcingValidator : Validator<SetOrderItemSourcingRequest>
{
    public SetOrderItemSourcingValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.OrderItemId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data.QuantityFromInventory)
            .GreaterThanOrEqualTo(0)
            .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}

/// <summary>
/// Endpoint recording how many of an order line's pieces are sourced from our own stock.
/// </summary>
/// <remarks>
/// Its own endpoint rather than a field on the full shipment PUT, for the same reason the
/// preparation checklist has one: the nakládka's "Z garáže" stepper is clicked once per piece, and
/// re-posting the entire run — stops, via points, purchases, checklist — to move a single piece
/// between two columns made a one-click adjustment wait on a whole-shipment rebuild.
///
/// Sourcing is progress rather than content (see <see cref="ShipmentContentGuard"/>), so it stays
/// writable for as long as the nakládka itself does: up to delivery, and never on a cancelled run.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
public sealed class SetOrderItemSourcingEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<SetOrderItemSourcingRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/order-items/{OrderItemId:guid}/sourcing");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetOrderItemSourcingEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets how many of an order line's pieces come from our own stock";
                s.Responses[StatusCodes.Status204NoContent] = "Sourcing stored";
                s.Responses[StatusCodes.Status400BadRequest] = "More than was ordered, or the run is no longer editable";
                s.Responses[StatusCodes.Status404NotFound] = "Shipment, order item or stock entry not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetOrderItemSourcingRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        // Just the run's order lines and the stock they already point at — no route, no invoices,
        // no checklist. That narrowness is the point of this endpoint.
        var shipment = await dbContext.OutgoingShipments
            .Include(os => os.Stops)
                .ThenInclude(s => s.ClientOrder!)
                    .ThenInclude(o => o.OrderItems)
                        .ThenInclude(oi => oi.InventoryItem)
            .FirstOrDefaultAsync(os => os.PublicId == req.Id, ct);

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

        var item = shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.OrderItems)
            .FirstOrDefault(i => i.PublicId == req.OrderItemId);

        if (item is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OrderItem), req.OrderItemId);
            return;
        }

        // More than was ordered is nonsense; more than is *in* stock is allowed, because a
        // booked-in delivery may still arrive before loading — the nakládka warns instead.
        if (req.Data.QuantityFromInventory > item.Quantity)
        {
            ThrowHelper.BadRequest(
                $"Cannot source {req.Data.QuantityFromInventory} pieces from inventory for an order item of {item.Quantity}.");
            return;
        }

        var quantity = req.Data.QuantityFromInventory;

        InventoryItem? stock = null;
        if (quantity > 0)
        {
            stock = await dbContext.InventoryItems
                .FirstOrDefaultAsync(i => i.PublicId == req.Data.InventoryItemId, ct);

            if (stock is null)
            {
                ThrowHelper.PublicEntityNotFound(nameof(InventoryItem), req.Data.InventoryItemId ?? Guid.Empty);
                return;
            }
        }

        // Past the Loaded boundary the pieces are already off the shelf, so a change of mind has
        // to move real stock rather than just a reservation: give back what the line held, take
        // what it now holds. Before that boundary nothing has moved yet and both are no-ops.
        if (ShipmentStateTransition.IsStockDrawn(shipment.State))
        {
            if (item.InventoryItem is not null)
                item.InventoryItem.Quantity += item.QuantityFromInventory;

            if (stock is not null)
                stock.Quantity -= quantity;
        }

        item.QuantityFromInventory = quantity;
        item.InventoryItem = stock;
        item.InventoryItemId = stock?.Id;

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
