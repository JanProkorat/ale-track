using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AleTrack.Features.OutgoingShipments.Commands.Update;

/// <summary>
/// Request model for updating an existing outgoing shipment
/// </summary>
public sealed record UpdateOutgoingShipmentRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment to be updated
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Data for updating an existing outgoing shipment
    /// </summary>
    [FromBody]
    public UpdateOutgoingShipmentDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint for updating an existing outgoing shipment
/// </summary>
/// <param name="dbContext"></param>
/// <param name="companyOptions"></param>
/// <param name="driverScope"></param>
public sealed class UpdateOutgoingShipmentEndpoint(
    AleTrackDbContext dbContext, IOptions<CompanyOptions> companyOptions, IDriverScope driverScope)
    : Endpoint<UpdateOutgoingShipmentRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateOutgoingShipmentEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates an existing outgoing shipment";
                s.Responses[StatusCodes.Status204NoContent] = "Outgoing shipment updated";
                s.Responses[StatusCodes.Status400BadRequest] = "Illegal state transition, or frozen content changed";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment, vehicle, drivers or orders not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateOutgoingShipmentRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        var outgoingShipment = await dbContext.OutgoingShipments
        .Include(os => os.Drivers)
            .ThenInclude(od => od.Driver)
        .Include(os => os.Vehicle)
        .Include(os => os.Stops)
            .ThenInclude(s => s.ClientOrder)
                .ThenInclude(s => s.OrderItems)
                    .ThenInclude(oi => oi.Product)
        .Include(os => os.StockPurchases)
            .ThenInclude(ei => ei.Product)
        .Include(os => os.Stops)
            .ThenInclude(s => s.ClientOrder!)
                .ThenInclude(o => o.OrderItems)
                    .ThenInclude(oi => oi.InventoryItem)
        .Include(os => os.Stops)
            .ThenInclude(s => s.ClientOrder!)
                .ThenInclude(o => o.CustomExtraItems)
        // What the two pickup-stop reconcilers read to decide which stops the run needs.
        .Include(os => os.Stops)
            .ThenInclude(s => s.ClientOrder!)
                .ThenInclude(o => o.SupplierGoodItems)
                    .ThenInclude(i => i.SupplierGood)
                        .ThenInclude(g => g.Supplier)
        .Include(os => os.RouteViaPoints)
        // Needed by ShipmentContentGuard, which compares the stop's delivery place by
        // public ID — without this the diff would read every place as removed.
        .Include(os => os.Stops)
            .ThenInclude(s => s.ClientDeliveryPlace)
        // The three below are what ShipmentContentSnapshotWriter reads and writes: the brewery
        // and client it snapshots, and the existing rows a revert has to orphan.
        .Include(os => os.Stops)
            .ThenInclude(s => s.ClientOrder!)
                .ThenInclude(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                        .ThenInclude(p => p.Brewery)
        .Include(os => os.Stops)
            .ThenInclude(s => s.ClientOrder!)
                .ThenInclude(o => o.Client)
        .Include(os => os.Stops)
            .ThenInclude(s => s.Items)
        .Include(os => os.PreparationSteps)
        // Needed by ShipmentContentGuard, which compares the stored start brewery by
        // public ID — without this every save of a brewery-started shipment would read
        // the brewery as removed and be wrongly rejected as frozen content.
        .Include(os => os.StartBrewery)
        .FirstOrDefaultAsync(os => os.PublicId == req.Id, ct);

        if (outgoingShipment is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        // Both guards run before anything touches the entity: GetOrderStopsAsync below
        // mutates existing stops in place, which would make the stored side of the content
        // diff reflect the request instead of the database.
        ShipmentStateTransition.EnsureAllowed(outgoingShipment!, req.Data.State);

        if (!ShipmentMutability.IsContentEditable(outgoingShipment.State))
        {
            var frozenChanges = ShipmentContentGuard.ChangedFrozenFields(outgoingShipment, req.Data);
            if (frozenChanges.Count > 0)
                ThrowHelper.ShipmentContentFrozen(outgoingShipment.State, frozenChanges);
        }

        // Checked separately from the block above because the checklist freezes later than the
        // truck's content does: preparing a run goes on while it is Loaded and InTransit, so the
        // list stays editable until the shipment is a historical record.
        if (!PurchaseInvoiceSplit.IsEditable(outgoingShipment)
            && ShipmentContentGuard.PreparationStepsChanged(outgoingShipment, req.Data))
        {
            ThrowHelper.ShipmentContentFrozen(
                outgoingShipment.State,
                [nameof(req.Data.PreparationSteps)]);
        }

        // Snapshot the orders currently on the shipment so we can free any that get removed.
        var previousStopOrders = outgoingShipment!.Stops
            .Where(s => s.ClientOrder != null)
            .Select(s => s.ClientOrder!)
            .ToList();

        var drivers = await GetDriversAsync(req.Data.DriverIds, outgoingShipment, ct);
        var vehicle = await GetVehicleAsync(req.Data.VehicleId, outgoingShipment, ct);
        var stops = await GetOrderStopsAsync(req.Data.ClientOrderShipments, outgoingShipment, ct);
        var customStops = BuildCustomStops(req.Data.CustomStops, outgoingShipment);
        var stockPurchases = await GetStockPurchasesAsync(req.Data.StockPurchases, outgoingShipment, ct);
        var startBrewery = await GetStartBreweryAsync(req.Data.StartPointKind, req.Data.StartBreweryId, req.Data.StartBreweryAddressKind, ct);

        outgoingShipment.DeliveryDate = req.Data.DeliveryDate;
        outgoingShipment.Name = req.Data.Name;
        outgoingShipment.Vehicle = vehicle;
        outgoingShipment.Drivers = drivers;
        outgoingShipment.StartPointKind = req.Data.StartPointKind;
        outgoingShipment.StartBrewery = startBrewery;
        outgoingShipment.StartBreweryId = startBrewery?.Id;
        outgoingShipment.StartBreweryAddressKind = req.Data.StartBreweryAddressKind;
        // Supplier stops are entirely derived from what the orders ask for, so — unlike the
        // company stop — the client does not round-trip them in CustomStops. Carried across
        // the wholesale replacement here so they keep their row identity and their place in
        // the route; the reconciler below then adds or removes them.
        var supplierStops = outgoingShipment.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Supplier)
            .ToList();

        outgoingShipment.Stops = [.. stops, .. customStops, .. supplierStops];
        outgoingShipment.RouteViaPoints = [.. req.Data.RouteViaPoints
            .Select((p, i) => new OutgoingShipmentRoutePoint { Order = i, Latitude = p.Latitude, Longitude = p.Longitude })];
        outgoingShipment.StockPurchases = stockPurchases;
        outgoingShipment.PreparationSteps = BuildPreparationSteps(req.Data.PreparationSteps, outgoingShipment);

        // Only while the content is still open: past Created the stock purchases cannot
        // change either, so there is nothing to reconcile and mutating a frozen run's
        // stops would be a bug.
        if (ShipmentMutability.IsContentEditable(outgoingShipment.State))
        {
            SupplierPickupStopReconciler.Apply(outgoingShipment);
            CompanyStopReconciler.Apply(outgoingShipment, companyOptions.Value);
        }

        ShipmentStateTransition.EnsureReady(outgoingShipment, req.Data.State);

        var requestedInventoryIds = req.Data.ClientOrderShipments
            .SelectMany(cos => cos.OrderItems)
            .Where(i => i.QuantityFromInventory > 0 && i.InventoryItemId is not null)
            .Select(i => i.InventoryItemId!.Value)
            .Distinct()
            .ToList();

        var inventoryByPublicId = requestedInventoryIds.Count == 0
            ? []
            : await dbContext.InventoryItems
                .Where(i => requestedInventoryIds.Contains(i.PublicId))
                .ToDictionaryAsync(i => i.PublicId, ct);

        foreach (var requestStop in req.Data.ClientOrderShipments)
        {
            var relatedStop = outgoingShipment.Stops.FirstOrDefault(s => s.ClientOrder != null && s.ClientOrder.PublicId == requestStop.ClientOrderId);
            if (relatedStop is null)
                continue;

            foreach (var requestOrderItem in requestStop.OrderItems)
            {
                var relatedItem = relatedStop.ClientOrder.OrderItems.FirstOrDefault(i => i.PublicId == requestOrderItem.OrderItemId);
                if (relatedItem is null)
                    continue;

                relatedItem.IsShipmentLoadingConfirmed = requestOrderItem.IsLoadingConfirmed;

                // Sourcing: how many of the ordered pieces come out of our own stock.
                // More than was ordered is nonsense; more than is *in* stock is allowed,
                // because a booked-in delivery may still arrive before loading — the
                // nakládka warns about it instead of blocking.
                if (requestOrderItem.QuantityFromInventory > relatedItem.Quantity)
                    ThrowHelper.BadRequest(
                        $"Cannot source {requestOrderItem.QuantityFromInventory} pieces from inventory for an order item of {relatedItem.Quantity}.");

                relatedItem.QuantityFromInventory = Math.Max(0, requestOrderItem.QuantityFromInventory);
                relatedItem.InventoryItem = relatedItem.QuantityFromInventory > 0
                    ? inventoryByPublicId.GetValueOrDefault(requestOrderItem.InventoryItemId ?? Guid.Empty)
                    : null;
                relatedItem.InventoryItemId = relatedItem.InventoryItem?.Id;

                if (relatedItem.QuantityFromInventory > 0 && relatedItem.InventoryItem is null)
                    ThrowHelper.PublicEntityNotFound(nameof(InventoryItem), requestOrderItem.InventoryItemId ?? Guid.Empty);
            }

            // Extras are the order's rows; the shipment only confirms them.
            foreach (var info in requestStop.CustomExtraItems)
            {
                var extra = relatedStop.ClientOrder.CustomExtraItems.FirstOrDefault(e => e.PublicId == info.Id);
                if (extra is not null)
                    extra.IsShipmentLoadingConfirmed = info.IsLoadingConfirmed;
            }
        }
        
        // An order dropped from the run is freed for reuse. Only this endpoint can drop one,
        // so it stays here rather than in the shared transition.
        var currentOrderIds = outgoingShipment.Stops
            .Where(s => s.ClientOrder != null)
            .Select(s => s.ClientOrder!.PublicId)
            .ToHashSet();

        foreach (var removed in previousStopOrders.Where(o => !currentOrderIds.Contains(o.PublicId)))
            removed.State = OrderState.New;

        // Assigns the state and applies every consequence — orders, stock, snapshot. Shared
        // with SetShipmentStateEndpoint so the two cannot drift.
        await ShipmentStateTransition.ApplyAsync(dbContext, outgoingShipment, req.Data.State, ct);

        await dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }


    private async Task<ICollection<OutgoingShipmentStop>> GetOrderStopsAsync(List<ClientOrderShipmentDto> clientOrderShipments, OutgoingShipment outgoingShipment, CancellationToken ct)
    {
        // Work only with order stops here — custom stops are handled separately.
        var orderStops = outgoingShipment.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Order && s.ClientOrder != null)
            .ToList();

        // Find orders present in the update request and not already linked to the outgoing shipment
        var existingOrderIds = orderStops
            .Select(s => s.ClientOrder!.PublicId)
            .ToHashSet();

        var newOrderIds = clientOrderShipments
            .Select(cos => cos.ClientOrderId)
            .Where(id => !existingOrderIds.Contains(id))
            .ToList();

        // Places already attached to this shipment's existing stops must stay
        // acceptable even if they were soft-deleted since — otherwise a
        // resave (e.g. flipping the nakládka checkboxes or advancing the
        // shipment's state) 404s forever once the place they used is
        // removed from the client. See ShipmentStopDeliveryPlaceResolver.
        var alreadyReferencedPlaceIds = orderStops
            .Where(s => s.ClientDeliveryPlaceId.HasValue)
            .Select(s => s.ClientDeliveryPlaceId!.Value)
            .Distinct()
            .ToList();

        var placeIds = await ShipmentStopDeliveryPlaceResolver.ResolveAsync(dbContext, clientOrderShipments, alreadyReferencedPlaceIds, ct);

        var stops = new List<OutgoingShipmentStop>(orderStops);

        // Add new orders
        if (newOrderIds.Count > 0)
        {
            // ShipmentContentSnapshotWriter.Apply runs on these same order entities when the
            // shipment transitions into Loaded within this same request (e.g. attaching an order
            // and setting the new state in one PUT) — it reads order.Client (for the client's own
            // price list and the ClientName/ClientPublicId snapshot fields) and
            // OrderItem.Product.Brewery (for BreweryName/BreweryPublicId). Without these includes
            // both navigations come back null (no lazy-loading proxies here), so the writer
            // silently degrades to ClientPriceList.Empty and bills the catalog price instead of
            // the client's own.
            var fetchedOrders = await dbContext.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                        .ThenInclude(p => p.Brewery)
                .Include(o => o.Client)
                .Where(o => newOrderIds.Contains(o.PublicId))
                .ToListAsync(ct);

            var fetchedOrderIds = fetchedOrders
                .Select(o => o.PublicId)
                .ToHashSet();

            var notFoundOrderIds = newOrderIds
                .Where(id => !fetchedOrderIds.Contains(id))
                .ToList();

            if (notFoundOrderIds.Count > 0)
                ThrowHelper.PublicEntitiesNotFound(nameof(Entities.Order), notFoundOrderIds);

            stops.AddRange(fetchedOrders
                .Select(o => new
                {
                    order = o,
                    requestOrder = clientOrderShipments.First(cos => cos.ClientOrderId == o.PublicId)
                })
                .Select(o =>
                {
                    var stop = new OutgoingShipmentStop
                    {
                        Kind = OutgoingShipmentStopKind.Order,
                        ClientOrder = o.order,
                        Order = o.requestOrder.Order,
                        SelectedAddressKind = o.requestOrder.SelectedAddressKind,
                        ClientDeliveryPlaceId = o.requestOrder.ClientDeliveryPlaceId.HasValue
                            ? placeIds[o.requestOrder.ClientDeliveryPlaceId.Value]
                            : null
                    };

                    // Derived, never sent: a stale client-supplied flag would silently
                    // disable propagation from the order.
                    stop.DeriveAddressOverride(o.order);

                    return stop;
                }));
        }

        // Remove orders present on the entity but not in the update request
        stops = [.. stops.Where(s => clientOrderShipments
            .Select(cos => cos.ClientOrderId)
            .Contains(s.ClientOrder!.PublicId))];

        // Update already-linked stops. Before this feature only Order was
        // written here, so changing a stop's address kind never persisted.
        foreach (var stop in stops.Where(s => existingOrderIds.Contains(s.ClientOrder!.PublicId)))
        {
            var matchingDto = clientOrderShipments.First(cos => cos.ClientOrderId == stop.ClientOrder!.PublicId);
            stop.Order = matchingDto.Order;
            stop.SelectedAddressKind = matchingDto.SelectedAddressKind;
            stop.ClientDeliveryPlaceId = matchingDto.ClientDeliveryPlaceId.HasValue
                ? placeIds[matchingDto.ClientDeliveryPlaceId.Value]
                : null;

            // Derived, never sent: a stale client-supplied flag would silently
            // disable propagation from the order.
            stop.DeriveAddressOverride(stop.ClientOrder!);
        }

        // The planner has just been looking at this shipment; whatever the
        // banner was announcing has been seen. Cleared for every stop, not
        // only the re-assigned ones.
        foreach (var stop in outgoingShipment.Stops)
            stop.AddressChangedAt = null;

        return stops;
    }

    private List<OutgoingShipmentStop> BuildCustomStops(List<CustomStopDto> customStops, OutgoingShipment outgoingShipment)
    {
        var company = companyOptions.Value;

        // Both non-order kinds live in this list; filtering to Custom alone would make
        // every Company stop look new on each save and orphan the stored row.
        var existingById = outgoingShipment.Stops
            .Where(s => s.Kind is OutgoingShipmentStopKind.Custom or OutgoingShipmentStopKind.Company)
            .ToDictionary(s => s.PublicId);

        var result = new List<OutgoingShipmentStop>();
        foreach (var dto in customStops)
        {
            var isCompany = dto.Kind == OutgoingShipmentStopKind.Company;
            var label = isCompany ? company.Name : dto.Label;
            var latitude = isCompany ? company.Latitude : dto.Latitude;
            var longitude = isCompany ? company.Longitude : dto.Longitude;

            if (dto.Id is not null && existingById.TryGetValue(dto.Id.Value, out var existing))
            {
                existing.Kind = dto.Kind;
                existing.Order = dto.Order;
                existing.Label = label;
                existing.Note = dto.Note;
                existing.Latitude = latitude;
                existing.Longitude = longitude;
                result.Add(existing);
            }
            else
            {
                result.Add(new OutgoingShipmentStop
                {
                    Kind = dto.Kind,
                    Order = dto.Order,
                    Label = label,
                    Note = dto.Note,
                    Latitude = latitude,
                    Longitude = longitude
                });
            }
        }

        return result;
    }

    /// <summary>
    /// Reconciles the preparation checklist against what is stored.
    /// </summary>
    /// <remarks>
    /// Existing steps are matched by public ID and keep their <c>IsDone</c>: the editor writes the
    /// list, the detail screen writes the ticks, and a save from either must not undo the other.
    /// Steps absent from the request are dropped — the collection is cascade-deleted, so severing
    /// them here removes the rows.
    /// </remarks>
    private static List<OutgoingShipmentPreparationStep> BuildPreparationSteps(
        List<PreparationStepDto> steps,
        OutgoingShipment outgoingShipment)
    {
        var existingById = outgoingShipment.PreparationSteps.ToDictionary(s => s.PublicId);

        var result = new List<OutgoingShipmentPreparationStep>();
        foreach (var dto in steps)
        {
            if (dto.Id is not null && existingById.TryGetValue(dto.Id.Value, out var existing))
            {
                existing.Order = dto.Order;
                existing.Label = dto.Label;
                result.Add(existing);
            }
            else
            {
                result.Add(new OutgoingShipmentPreparationStep
                {
                    PublicId = Guid.NewGuid(),
                    Order = dto.Order,
                    Label = dto.Label,
                    IsDone = false
                });
            }
        }

        return result;
    }

    private async Task<List<OutgoingShipmentDriver>> GetDriversAsync(List<Guid> driverIds, OutgoingShipment outgoingShipment, CancellationToken ct)
    {
        // Add new drivers
        var existingDriverIds = outgoingShipment.Drivers
            .Select(d => d.Driver.PublicId)
            .ToHashSet();

        var newDriverIds = driverIds
            .Where(id => !existingDriverIds.Contains(id))
            .ToList();

        var drivers = new List<OutgoingShipmentDriver>(outgoingShipment.Drivers);

        if (newDriverIds.Count > 0)
        {
            var fetchedDrivers = await dbContext.Drivers
                .Where(d => newDriverIds.Contains(d.PublicId))
                .ToListAsync(ct);

            var fetchedDriverIds = fetchedDrivers
                .Select(d => d.PublicId)
                .ToHashSet();

            var notFoundDriverIds = newDriverIds
                .Where(id => !fetchedDriverIds.Contains(id))
                .ToList();

            if (notFoundDriverIds.Count > 0)
                ThrowHelper.PublicEntitiesNotFound(nameof(Driver), notFoundDriverIds);

            drivers.AddRange(fetchedDrivers
            .Select(d => new OutgoingShipmentDriver
            {
                Driver = d
            }));
        }

        // Remove drivers present on the entity but not in the update request
        drivers = [.. drivers.Where(d => driverIds.Contains(d.Driver.PublicId))];

        return drivers;
    }

    private async Task<Vehicle?> GetVehicleAsync(Guid? vehicleId, OutgoingShipment outgoingShipment, CancellationToken ct)
    {
        if (vehicleId == outgoingShipment.Vehicle?.PublicId)
            return outgoingShipment.Vehicle;

        if (vehicleId is null)
            return null;

        var vehicle = await dbContext.Vehicles
            .FirstOrDefaultAsync(v => v.PublicId == vehicleId, ct);

        if (vehicle is null)
            ThrowHelper.PublicEntityNotFound(nameof(Vehicle), vehicleId.Value);

        return vehicle;
    }

    /// <summary>
    /// Resolves the brewery a run starts at, or null when it starts at the company.
    /// </summary>
    private async Task<Brewery?> GetStartBreweryAsync(
        ShipmentStartPointKind kind, Guid? breweryId, DeliveryAddressKind addressKind, CancellationToken ct)
    {
        if (kind != ShipmentStartPointKind.Brewery || breweryId is null)
        {
            return null;
        }

        var brewery = await dbContext.Breweries
            .FirstOrDefaultAsync(b => b.PublicId == breweryId, ct);

        if (brewery is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Brewery), breweryId.Value);
        }

        // The frontend merely hides the option; nothing stops a direct caller
        // from asking for a contact address the brewery does not have.
        if (addressKind == DeliveryAddressKind.Contact && brewery!.ContactAddress is null)
        {
            ThrowHelper.BadRequest($"Brewery {brewery.PublicId} has no contact address.");
        }

        return brewery;
    }

    private async Task<List<OutgoingShipmentStockPurchaseItem>> GetStockPurchasesAsync(List<StockPurchaseDto> stockPurchaseDtos, OutgoingShipment outgoingShipment, CancellationToken ct)
    {
        if (stockPurchaseDtos.Count == 0)
            return [];

        var existingById = outgoingShipment.StockPurchases
            .ToDictionary(ei => ei.PublicId);

        // Only new items need their product resolved — existing items are matched
        // by Id and keep their already-linked product, so their (possibly not
        // round-tripped) ProductId must not trigger a lookup.
        var newProductIds = stockPurchaseDtos
            .Where(es => es.Id is null || !existingById.ContainsKey(es.Id.Value))
            .Select(es => es.ProductId)
            .Distinct()
            .ToList();

        var productsByPublicId = new Dictionary<Guid, Product>();
        if (newProductIds.Count > 0)
        {
            var fetchedProducts = await dbContext.Products
                .Where(p => newProductIds.Contains(p.PublicId) && !p.IsDeleted)
                .ToListAsync(ct);

            if (fetchedProducts.Count != newProductIds.Count)
            {
                var notFound = newProductIds.Except(fetchedProducts.Select(p => p.PublicId)).ToList();
                ThrowHelper.PublicEntitiesNotFound(nameof(Product), notFound);
            }

            productsByPublicId = fetchedProducts.ToDictionary(p => p.PublicId);
        }

        var result = new List<OutgoingShipmentStockPurchaseItem>();

        foreach (var dto in stockPurchaseDtos)
        {
            if (dto.Id is not null && existingById.TryGetValue(dto.Id.Value, out var existing))
            {
                // Update existing item
                existing.Quantity = dto.Quantity;
                existing.IsShipmentLoadingConfirmed = dto.IsLoadingConfirmed;
                result.Add(existing);
            }
            else
            {
                // Create new item
                result.Add(new OutgoingShipmentStockPurchaseItem
                {
                    PublicId = Guid.NewGuid(),
                    Product = productsByPublicId[dto.ProductId],
                    IsShipmentLoadingConfirmed = dto.IsLoadingConfirmed,
                    Quantity = dto.Quantity
                });
            }
        }

        return result;
    }
}