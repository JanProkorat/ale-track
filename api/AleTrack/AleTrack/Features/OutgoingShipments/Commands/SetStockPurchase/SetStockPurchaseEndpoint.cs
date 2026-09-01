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

namespace AleTrack.Features.OutgoingShipments.Commands.SetStockPurchase;

/// <summary>
/// How many pieces of one product this run buys for our own warehouse — "Zboží na sklad".
/// </summary>
public sealed record SetStockPurchaseDto
{
    /// <summary>
    /// Public ID of the product being bought.
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Pieces to buy. Zero removes the line.
    /// </summary>
    /// <remarks>
    /// Absolute, not a delta: the caller always knows the quantity on screen, and an absolute
    /// write is idempotent — a retried or double-fired request lands on the same number, where
    /// a repeated delta would quietly buy twice.
    /// </remarks>
    public int Quantity { get; set; }
}

/// <summary>
/// Request to set one stock-purchase line on an outgoing shipment.
/// </summary>
public sealed record SetStockPurchaseRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Product and quantity.
    /// </summary>
    [FromBody]
    public SetStockPurchaseDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="SetStockPurchaseRequest"/>.
/// </summary>
public sealed class SetStockPurchaseValidator : Validator<SetStockPurchaseRequest>
{
    public SetStockPurchaseValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data.ProductId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data.Quantity)
            .GreaterThanOrEqualTo(0)
            .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}

/// <summary>
/// Endpoint setting how many pieces of a product a run buys for our own warehouse.
/// </summary>
/// <remarks>
/// Its own endpoint rather than a field on the full shipment PUT, for the same reason the
/// sourcing stepper has one: "Do garáže" is clicked once per piece, and re-posting the whole
/// run — stops, order lines, via points, checklist — to change one quantity made every click
/// wait on a whole-shipment rebuild.
///
/// Keyed by product rather than by row ID because one product is one line here: the nakládka
/// aggregates by product and the add dialog tops up an existing line rather than opening a
/// second one, so the product is the identity the screen actually works in.
///
/// Unlike sourcing, a stock purchase is <em>content</em> (<see cref="ShipmentContentGuard"/>) —
/// it is a thing bought and put on the truck, not a note about where pieces came from — so it
/// freezes with the rest of the load. See <see cref="ShipmentMutability.IsContentEditable"/>.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
/// <param name="companyOptions"></param>
public sealed class SetStockPurchaseEndpoint(
    AleTrackDbContext dbContext,
    IDriverScope driverScope,
    IOptions<CompanyOptions> companyOptions)
    : Endpoint<SetStockPurchaseRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/stock-purchases");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetStockPurchaseEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets how many pieces of a product the run buys for our warehouse";
                s.Responses[StatusCodes.Status204NoContent] = "Stock purchase stored";
                s.Responses[StatusCodes.Status400BadRequest] = "The run's content is frozen";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment or product not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetStockPurchaseRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        // The purchase lines and the products behind them, plus the route and the supplier-good
        // lines under it — CompanyStopReconciler reads both to decide whether the run still has
        // business at the warehouse. Still narrower than the full PUT, which also needs the
        // invoice graph in order to diff it.
        var shipment = await dbContext.OutgoingShipments
            .Include(os => os.StockPurchases)
                .ThenInclude(sp => sp.Product)
            .Include(os => os.Stops)
                .ThenInclude(s => s.ClientOrder!)
                    .ThenInclude(o => o.SupplierGoodItems)
            .FirstOrDefaultAsync(os => os.PublicId == req.Id, ct);

        if (shipment is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return;
        }

        if (!ShipmentMutability.IsContentEditable(shipment.State))
        {
            ThrowHelper.ShipmentContentFrozen(shipment.State, [nameof(shipment.StockPurchases)]);
            return;
        }

        var existing = shipment.StockPurchases
            .FirstOrDefault(sp => sp.Product.PublicId == req.Data.ProductId);

        if (req.Data.Quantity == 0)
        {
            // Orphaning the row deletes it: the FK to the shipment is required, so EF cascades.
            // Same mechanism the full PUT's rebuild relies on to drop a removed line.
            if (existing is not null)
                shipment.StockPurchases.Remove(existing);
        }
        else if (existing is not null)
        {
            existing.Quantity = req.Data.Quantity;
        }
        else
        {
            // Retired products are excluded — buying one is a new commitment, unlike the
            // sourcing endpoint, which only re-points pieces the run already carries.
            var product = await dbContext.Products
                .FirstOrDefaultAsync(p => p.PublicId == req.Data.ProductId && !p.IsDeleted, ct);

            if (product is null)
            {
                ThrowHelper.PublicEntityNotFound(nameof(Product), req.Data.ProductId);
                return;
            }

            shipment.StockPurchases.Add(new OutgoingShipmentStockPurchaseItem
            {
                PublicId = Guid.NewGuid(),
                Product = product,
                Quantity = req.Data.Quantity,
                IsShipmentLoadingConfirmed = false
            });
        }

        // Buying for stock gives the run something to do at our own warehouse, so the route needs
        // the company stop — and loses it again when the last line goes. Server-side, in the same
        // reconciler the route save and the sourcing stepper use, so the three cannot disagree.
        CompanyStopReconciler.Apply(shipment, companyOptions.Value);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
