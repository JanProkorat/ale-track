using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AleTrack.Features.OutgoingShipments.Commands.SetSupplierGoodSourcing;

/// <summary>
/// How many of one supplier-good line's pieces come off our own shelf instead of being
/// collected at the supplier.
/// </summary>
public sealed record SetSupplierGoodSourcingDto
{
    /// <summary>
    /// Pieces taken from the garage. Zero means the whole line is collected at the supplier.
    /// </summary>
    public int QuantityFromGarage { get; set; }
}

/// <summary>
/// Request to set one supplier-good line's sourcing on a shipment.
/// </summary>
public sealed record SetSupplierGoodSourcingRequest
{
    /// <summary>Public ID of the outgoing shipment.</summary>
    public Guid Id { get; set; }

    /// <summary>Public ID of the supplier-good order line being sourced.</summary>
    public Guid ItemId { get; set; }

    /// <summary>The new split.</summary>
    [FromBody]
    public SetSupplierGoodSourcingDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="SetSupplierGoodSourcingRequest"/>.
/// </summary>
public sealed class SetSupplierGoodSourcingValidator : Validator<SetSupplierGoodSourcingRequest>
{
    public SetSupplierGoodSourcingValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.ItemId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data.QuantityFromGarage)
            .GreaterThanOrEqualTo(0)
            .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}

/// <summary>
/// Endpoint recording how many of a supplier-good line's pieces come from the garage, and
/// re-deriving the run's pickup stops from the answer.
/// </summary>
/// <remarks>
/// Its own narrow endpoint for the same reason
/// <see cref="SetOrderItemSourcing.SetOrderItemSourcingEndpoint"/> has one: the stepper is
/// clicked once per piece, and re-posting the whole run per click made each click wait on a
/// whole-shipment rebuild.
///
/// Unlike that endpoint, this one also re-runs both pickup reconcilers. Moving the last piece
/// of a good into the garage is what makes a supplier stop pointless, and moving the last
/// garage piece out is what makes the warehouse stop pointless — so the route has to follow
/// the click, not wait for the next full save.
/// </remarks>
public sealed class SetSupplierGoodSourcingEndpoint(
    AleTrackDbContext dbContext,
    IDriverScope driverScope,
    IOptions<CompanyOptions> companyOptions)
    : Endpoint<SetSupplierGoodSourcingRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/supplier-goods/{ItemId:guid}/sourcing");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetSupplierGoodSourcingEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets how many of a supplier-good line's pieces come from the garage";
                s.Responses[StatusCodes.Status204NoContent] = "Sourcing stored";
                s.Responses[StatusCodes.Status400BadRequest] = "More than was ordered, or the run is no longer editable";
                s.Responses[StatusCodes.Status404NotFound] = "Shipment or line not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetSupplierGoodSourcingRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        // Wider than the order-item equivalent, because the reconcilers below read the whole
        // run: every stop, every supplier-good line, and the good and supplier behind each.
        var shipment = await dbContext.OutgoingShipments
            .Include(os => os.StockPurchases)
            .Include(os => os.Stops)
                .ThenInclude(s => s.ClientOrder!)
                    .ThenInclude(o => o.SupplierGoodItems)
                        .ThenInclude(i => i.SupplierGood)
                            .ThenInclude(g => g.Supplier)
            .Include(os => os.Stops)
                .ThenInclude(s => s.ClientOrder!)
                    .ThenInclude(o => o.SupplierGoodItems)
                        .ThenInclude(i => i.SupplierGood)
                            .ThenInclude(g => g.InventoryItem)
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
            .SelectMany(s => s.ClientOrder!.SupplierGoodItems)
            .FirstOrDefault(i => i.PublicId == req.ItemId);

        if (item is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OrderSupplierGoodItem), req.ItemId);
            return;
        }

        if (req.Data.QuantityFromGarage > item.Quantity)
        {
            ThrowHelper.BadRequest(
                $"Cannot source {req.Data.QuantityFromGarage} pieces from the garage for a line of {item.Quantity}.");
            return;
        }

        var quantity = req.Data.QuantityFromGarage;

        // Past the Loaded boundary the pieces are already off the shelf, so a change of mind has
        // to move real stock rather than a reservation: give back what the line held, take what
        // it now holds. Before that boundary nothing has moved and both are no-ops. Mirrors the
        // order-item endpoint; a good the warehouse does not track has no row to adjust.
        var stock = item.SupplierGood?.InventoryItem;
        if (ShipmentStateTransition.IsStockDrawn(shipment.State) && stock is not null)
        {
            stock.Quantity += item.QuantityFromGarage;
            stock.Quantity -= quantity;
        }

        item.QuantityFromGarage = quantity;

        // The whole reason this endpoint is not just a field write: the split decides which
        // pickup stops the run needs, so both have to be re-derived before the save.
        SupplierPickupStopReconciler.Apply(shipment);
        CompanyStopReconciler.Apply(shipment, companyOptions.Value);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
