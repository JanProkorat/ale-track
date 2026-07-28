using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

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
public sealed class UpdateOutgoingShipmentEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateOutgoingShipmentRequest>
{
    /// <summary>
    /// States in which the OutgoingShipment has to have filled all data
    /// </summary>
    private readonly OutgoingShipmentState[] _statesWithFilledData = [
        OutgoingShipmentState.Delivered, 
        OutgoingShipmentState.InTransit
    ];

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
        .FirstOrDefaultAsync(os => os.PublicId == req.Id, ct);

        if (outgoingShipment is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        // Both guards run before anything touches the entity: GetOrderStopsAsync below
        // mutates existing stops in place, which would make the stored side of the content
        // diff reflect the request instead of the database.
        if (!ShipmentMutability.IsTransitionAllowed(outgoingShipment!.State, req.Data.State))
            ThrowHelper.ShipmentTransitionNotAllowed(outgoingShipment.State, req.Data.State);

        if (!ShipmentMutability.IsContentEditable(outgoingShipment.State))
        {
            var frozenChanges = ShipmentContentGuard.ChangedFrozenFields(outgoingShipment, req.Data);
            if (frozenChanges.Count > 0)
                ThrowHelper.ShipmentContentFrozen(outgoingShipment.State, frozenChanges);
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

        outgoingShipment.DeliveryDate = req.Data.DeliveryDate;
        outgoingShipment.Name = req.Data.Name;
        outgoingShipment.Vehicle = vehicle;
        outgoingShipment.Drivers = drivers;
        outgoingShipment.Stops = [.. stops, .. customStops];
        outgoingShipment.RouteViaPoints = [.. req.Data.RouteViaPoints
            .Select((p, i) => new OutgoingShipmentRoutePoint { Order = i, Latitude = p.Latitude, Longitude = p.Longitude })];
        outgoingShipment.StockPurchases = stockPurchases;

        if (req.Data.State is OutgoingShipmentState.Loaded && outgoingShipment.Stops.Count == 0)
            ThrowHelper.ShipmentCannotBeLoadedWithoutStops();

        if (_statesWithFilledData.Contains(req.Data.State) && !outgoingShipment.HasFilledData)
            ThrowHelper.ShipmentNotPrepared(req.Data.State);
        
        // Both checks must be taken before the new state is assigned below.
        // isTransitioningToLoaded used to be computed after that assignment, so it was
        // always false and inventory was never actually drawn down.
        var isTransitioningToDelivered = outgoingShipment.State != OutgoingShipmentState.Delivered
                                        && req.Data.State == OutgoingShipmentState.Delivered;

        var isTransitioningToLoaded = outgoingShipment.State != OutgoingShipmentState.Loaded
                                      && req.Data.State == OutgoingShipmentState.Loaded;

        var isRevertingToCreated = outgoingShipment.State != OutgoingShipmentState.Created
                                   && req.Data.State == OutgoingShipmentState.Created;

        outgoingShipment.State = req.Data.State;

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
        
        // Order lifecycle follows the shipment: added → Planning, InTransit →
        // Delivering, Delivered → Finished (+ actual delivery date), Cancelled or
        // removed → back to New (freed for reuse).
        var currentStopOrders = outgoingShipment.Stops
            .Where(s => s.ClientOrder != null)
            .Select(s => s.ClientOrder!)
            .ToList();
        var currentOrderIds = currentStopOrders.Select(o => o.PublicId).ToHashSet();

        foreach (var removed in previousStopOrders.Where(o => !currentOrderIds.Contains(o.PublicId)))
            removed.State = OrderState.New;

        foreach (var order in currentStopOrders)
        {
            switch (req.Data.State)
            {
                case OutgoingShipmentState.Cancelled:
                    order.State = OrderState.New;
                    break;
                case OutgoingShipmentState.Delivered:
                    order.State = OrderState.Finished;
                    order.ActualDeliveryDate ??= DateOnly.FromDateTime(DateTime.UtcNow);
                    break;
                case OutgoingShipmentState.InTransit:
                    order.State = OrderState.Delivering;
                    break;
                default: // Created / Loaded
                    // New orders enter planning; reverting a shipment from InTransit
                    // back to Loaded pulls its orders out of Delivering too.
                    if (order.State is OrderState.New or OrderState.Delivering)
                        order.State = OrderState.Planning;
                    break;
            }
        }

        if (req.Data.State == OutgoingShipmentState.Cancelled)
            ResetOrderItemsForReuse(outgoingShipment);

        if (isTransitioningToLoaded)
            SubtractFromInventory(outgoingShipment);

        // Snapshot at the same boundary that freezes content, so the two cannot diverge. The
        // reports read nothing else from here on.
        if (isTransitioningToLoaded)
            ShipmentContentSnapshotWriter.Apply(outgoingShipment);

        // Reverting reopens the content for editing, so a kept snapshot would go stale. It is
        // rebuilt on the next transition into Loaded.
        if (isRevertingToCreated)
            ShipmentContentSnapshotWriter.Clear(outgoingShipment);

        if (isTransitioningToDelivered && outgoingShipment.StockPurchases.Count > 0)
            await AddStockPurchasesToInventoryAsync(outgoingShipment.StockPurchases, ct);

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
            var fetchedOrders = await dbContext.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
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

    private static List<OutgoingShipmentStop> BuildCustomStops(List<CustomStopDto> customStops, OutgoingShipment outgoingShipment)
    {
        var existingById = outgoingShipment.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Custom)
            .ToDictionary(s => s.PublicId);

        var result = new List<OutgoingShipmentStop>();
        foreach (var dto in customStops)
        {
            if (dto.Id is not null && existingById.TryGetValue(dto.Id.Value, out var existing))
            {
                existing.Order = dto.Order;
                existing.Label = dto.Label;
                existing.Note = dto.Note;
                existing.Latitude = dto.Latitude;
                existing.Longitude = dto.Longitude;
                result.Add(existing);
            }
            else
            {
                result.Add(new OutgoingShipmentStop
                {
                    Kind = OutgoingShipmentStopKind.Custom,
                    Order = dto.Order,
                    Label = dto.Label,
                    Note = dto.Note,
                    Latitude = dto.Latitude,
                    Longitude = dto.Longitude
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
    /// Takes the inventory-sourced pieces of each order item out of stock. Runs on the
    /// transition to Loaded — stock is consumed when the truck is packed.
    /// </summary>
    /// <remarks>
    /// Stock is allowed to go negative: the depot may knowingly load against a delivery
    /// that has not been booked in yet, and the nakládka warns about it rather than
    /// blocking the load.
    /// </remarks>
    private static void SubtractFromInventory(OutgoingShipment outgoingShipment)
    {
        foreach (var stop in outgoingShipment.Stops.Where(s => s.ClientOrder is not null))
        foreach (var item in stop.ClientOrder!.OrderItems.Where(i => i.QuantityFromInventory > 0 && i.InventoryItem is not null))
            item.InventoryItem!.Quantity -= item.QuantityFromInventory;
    }

    /// <summary>
    /// Clears the shipment-scoped fields on a freed order so it can be planned onto
    /// another loading. Null-guarded: a custom stop has no order, and the previous
    /// version dereferenced ClientOrder unconditionally.
    /// </summary>
    private static void ResetOrderItemsForReuse(OutgoingShipment outgoingShipment)
    {
        foreach (var stop in outgoingShipment.Stops.Where(s => s.ClientOrder is not null))
        {
            foreach (var orderItem in stop.ClientOrder!.OrderItems)
            {
                orderItem.IsShipmentLoadingConfirmed = false;
                orderItem.QuantityFromInventory = 0;
                orderItem.InventoryItem = null;
                orderItem.InventoryItemId = null;
            }

            foreach (var extra in stop.ClientOrder.CustomExtraItems)
                extra.IsShipmentLoadingConfirmed = false;
        }
    }

    private async Task AddStockPurchasesToInventoryAsync(ICollection<OutgoingShipmentStockPurchaseItem> stockPurchases, CancellationToken ct)
    {
        var newInventoryItems = new List<InventoryItem>();
        // Match product-linked extra items to existing inventory
        
        var productIds = stockPurchases
            .Select(ei => ei.Product.Id)
            .ToList();
        
        var existingInventory = await dbContext.InventoryItems
            .Where(i => i.ProductId != null && productIds.Contains(i.ProductId.Value))
            .ToListAsync(ct);

        var inventoryByProductId = existingInventory.ToDictionary(i => i.ProductId!.Value);

        foreach (var item in stockPurchases)
        {
            if (inventoryByProductId.TryGetValue(item.Product.Id, out var existing))
                existing.Quantity += item.Quantity;
            else
            {
                newInventoryItems.Add(new InventoryItem
                {
                    PublicId = Guid.NewGuid(),
                    ProductId = item.Product.Id,
                    Quantity = item.Quantity
                });
            }
        }
        
        if (newInventoryItems.Count > 0)
            dbContext.InventoryItems.AddRange(newInventoryItems);
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