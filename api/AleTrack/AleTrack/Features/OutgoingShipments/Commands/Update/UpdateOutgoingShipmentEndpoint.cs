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
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateOutgoingShipmentEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates an existing outgoing shipment";
                s.Responses[StatusCodes.Status204NoContent] = "Outgoing shipment updated";
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
        .Include(os => os.InventoryExtraItems)
            .ThenInclude(ei => ei.Product)
        .Include(os => os.ClientExtraItems)
            .ThenInclude(ei => ei.InventoryItem)
        .FirstOrDefaultAsync(os => os.PublicId == req.Id, ct);

        if (outgoingShipment is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        var drivers = await GetDriversAsync(req.Data.DriverIds, outgoingShipment, ct);
        var vehicle = await GetVehicleAsync(req.Data.VehicleId, outgoingShipment, ct);
        var stops = await GetOrderStopsAsync(req.Data.ClientOrderShipments, outgoingShipment, ct);
        var inventoryExtraItems = await GetInventoryExtraItemsAsync(req.Data.InventoryExtraShipments, outgoingShipment, ct);
        var clientExtraItems = await GetClientExtraItemsAsync(req.Data.ClientExtraShipments, outgoingShipment, ct);
        var customExtraItems = GetCustomExtraItems(req.Data.CustomExtraShipments, outgoingShipment);
        
        outgoingShipment.DeliveryDate = req.Data.DeliveryDate;
        outgoingShipment.Name = req.Data.Name;
        outgoingShipment.Vehicle = vehicle;
        outgoingShipment.Drivers = drivers;
        outgoingShipment.Stops = stops;
        outgoingShipment.InventoryExtraItems = inventoryExtraItems;
        outgoingShipment.ClientExtraItems = clientExtraItems;
        outgoingShipment.CustomExtraItems = customExtraItems;

        if (req.Data.State is OutgoingShipmentState.Loaded && outgoingShipment.Stops.Count == 0)
            ThrowHelper.ShipmentCannotBeLoadedWithoutStops();

        if (_statesWithFilledData.Contains(req.Data.State) && !outgoingShipment.HasFilledData)
            ThrowHelper.ShipmentNotPrepared(req.Data.State);
        
        var isTransitioningToDelivered = outgoingShipment.State != OutgoingShipmentState.Delivered
                                        && req.Data.State == OutgoingShipmentState.Delivered;

        outgoingShipment.State = req.Data.State;

        foreach (var requestStop in req.Data.ClientOrderShipments)
        {
            var relatedStop = outgoingShipment.Stops.FirstOrDefault(s => s.ClientOrder.PublicId == requestStop.ClientOrderId);
            if (relatedStop is null)
                continue;

            foreach (var requestOrderItem in requestStop.OrderItems)
            {
                var relatedItem = relatedStop.ClientOrder.OrderItems.FirstOrDefault(i => i.PublicId == requestOrderItem.OrderItemId);
                relatedItem?.IsShipmentLoadingConfirmed = requestOrderItem.IsLoadingConfirmed;
                relatedItem?.FirstInvoiceQuantity = requestOrderItem.FirstInvoiceQuantity;
                relatedItem?.SecondInvoiceQuantity = requestOrderItem.SecondInvoiceQuantity;
            }
        }
        
        var isTransitioningToLoaded = outgoingShipment.State != OutgoingShipmentState.Loaded
                                     && req.Data.State == OutgoingShipmentState.Loaded;

        if (req.Data.State == OutgoingShipmentState.Cancelled)
            ResetOrderItemsForReuse(outgoingShipment);

        if (isTransitioningToLoaded)
            SubtractFromInventory(outgoingShipment.ClientExtraItems);

        if (isTransitioningToDelivered && outgoingShipment.InventoryExtraItems.Count > 0)
            await AddExtraItemsToInventoryAsync(outgoingShipment.InventoryExtraItems, ct);

        await dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }

    private List<OutgoingShipmentCustomExtraItem> GetCustomExtraItems(List<CustomExtraShipmentDto> extraItems, OutgoingShipment outgoingShipment)
    {
        var newItems = extraItems
            .Where(ei => ei.Id is null)
            .ToList();
        
        var resultItems = newItems
            .Select(i => new OutgoingShipmentCustomExtraItem
            {
                Description = i.Description,
                FirstInvoiceQuantity = i.FirstInvoiceQuantity,
                SecondInvoiceQuantity = i.SecondInvoiceQuantity,
                IsShipmentLoadingConfirmed = i.IsLoadingConfirmed,
                Quantity = i.Quantity
            })
            .ToList();
        
        var existingItems = extraItems
            .Where(ei => ei.Id is not null 
                         && outgoingShipment.CustomExtraItems.Any(ei2 => ei2.PublicId == ei.Id.Value))
            .ToList();
        
        foreach (var item in existingItems)
        {
            var existing = outgoingShipment.CustomExtraItems.First(ei => ei.PublicId == item.Id!.Value);
            existing.Description = item.Description;
            existing.FirstInvoiceQuantity = item.FirstInvoiceQuantity;
            existing.SecondInvoiceQuantity = item.SecondInvoiceQuantity;
            existing.IsShipmentLoadingConfirmed = item.IsLoadingConfirmed;
            existing.Quantity = item.Quantity;
            
            resultItems.Add(existing);
        }
        
        return resultItems;
    }

    private async Task<ICollection<OutgoingShipmentStop>> GetOrderStopsAsync(List<ClientOrderShipmentDto> clientOrderShipments, OutgoingShipment outgoingShipment, CancellationToken ct)
    {
        // Find orders present in the update request and not already linked to the outgoing shipment
        var existingOrderIds = outgoingShipment.Stops
            .Select(s => s.ClientOrder.PublicId)
            .ToHashSet();

        var newOrderIds = clientOrderShipments
            .Select(cos => cos.ClientOrderId)
            .Where(id => !existingOrderIds.Contains(id))
            .ToList();

        var stops = new List<OutgoingShipmentStop>(outgoingShipment.Stops);

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
                .Select(o => new OutgoingShipmentStop
                {
                    ClientOrder = o.order,
                    Order = o.requestOrder.Order,
                    SelectedAddressKind = o.requestOrder.SelectedAddressKind
                }));
        }

        // Remove orders present on the entity but not in the update request
        stops = [.. stops.Where(s => clientOrderShipments
            .Select(cos => cos.ClientOrderId)
            .Contains(s.ClientOrder.PublicId))];
        
        // Update order of the stops
        foreach (var stop in stops.Where(s => existingOrderIds.Contains(s.ClientOrder.PublicId)))
        {
            var matchingDto = clientOrderShipments.First(cos => cos.ClientOrderId == stop.ClientOrder.PublicId);
            stop.Order = matchingDto.Order;
        }

        return stops;
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

    private static void SubtractFromInventory(ICollection<OutgoingShipmentClientExtraItem> extraItems)
    {
        foreach (var item in extraItems)
            item.InventoryItem.Quantity -= item.Quantity;
    }

    private static void ResetOrderItemsForReuse(OutgoingShipment outgoingShipment)
    {
        foreach (var stop in outgoingShipment.Stops)
        {
            foreach (var orderItem in stop.ClientOrder.OrderItems)
            {
                orderItem.FirstInvoiceQuantity = null;
                orderItem.SecondInvoiceQuantity = null;
                orderItem.IsShipmentLoadingConfirmed = false;
            }
        }
    }

    private async Task AddExtraItemsToInventoryAsync(ICollection<OutgoingShipmentInventoryExtraItem> extraItems, CancellationToken ct)
    {
        var newInventoryItems = new List<InventoryItem>();
        // Match product-linked extra items to existing inventory
        
        var productIds = extraItems
            .Select(ei => ei.Product.Id)
            .ToList();
        
        var existingInventory = await dbContext.InventoryItems
            .Where(i => i.ProductId != null && productIds.Contains(i.ProductId.Value))
            .ToListAsync(ct);

        var inventoryByProductId = existingInventory.ToDictionary(i => i.ProductId!.Value);

        foreach (var item in extraItems)
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

    private async Task<List<OutgoingShipmentClientExtraItem>> GetClientExtraItemsAsync(List<ClientExtraShipmentDto> extraShipments, OutgoingShipment outgoingShipment, CancellationToken ct)
    {
        if (extraShipments.Count == 0)
            return [];

        var existingById = outgoingShipment.ClientExtraItems
            .ToDictionary(ei => ei.PublicId);

        // Fetch products for new items that reference a product
        var newProductIds = extraShipments
            .Select(es => es.InventoryItemId)
            .Distinct()
            .ToList();

        var productsByPublicId = new Dictionary<Guid, InventoryItem>();
        if (newProductIds.Count > 0)
        {
            var fetchedProducts = await dbContext.InventoryItems
                .Where(p => newProductIds.Contains(p.PublicId))
                .ToListAsync(ct);

            if (fetchedProducts.Count != newProductIds.Count)
            {
                var notFound = newProductIds.Except(fetchedProducts.Select(p => p.PublicId)).ToList();
                ThrowHelper.PublicEntitiesNotFound(nameof(Product), notFound);
            }

            productsByPublicId = fetchedProducts.ToDictionary(p => p.PublicId);
        }

        var result = new List<OutgoingShipmentClientExtraItem>();

        foreach (var dto in extraShipments)
        {
            if (dto.Id is not null && existingById.TryGetValue(dto.Id.Value, out var existing))
            {
                // Update existing item
                existing.Quantity = dto.Quantity;
                existing.IsShipmentLoadingConfirmed = dto.IsLoadingConfirmed;
                existing.FirstInvoiceQuantity = dto.FirstInvoiceQuantity;
                existing.SecondInvoiceQuantity = dto.SecondInvoiceQuantity;
                result.Add(existing);
            }
            else
            {
                // Create new item
                result.Add(new OutgoingShipmentClientExtraItem
                {
                    PublicId = Guid.NewGuid(),
                    InventoryItem = productsByPublicId[dto.InventoryItemId],
                    IsShipmentLoadingConfirmed = dto.IsLoadingConfirmed,
                    FirstInvoiceQuantity = dto.FirstInvoiceQuantity,
                    SecondInvoiceQuantity = dto.SecondInvoiceQuantity,
                    Quantity = dto.Quantity
                });
            }
        }

        return result;
    }
    
    private async Task<List<OutgoingShipmentInventoryExtraItem>> GetInventoryExtraItemsAsync(List<InventoryExtraShipmentDto> extraShipments, OutgoingShipment outgoingShipment, CancellationToken ct)
    {
        if (extraShipments.Count == 0)
            return [];

        var existingById = outgoingShipment.InventoryExtraItems
            .ToDictionary(ei => ei.PublicId);

        // Fetch products for new items that reference a product
        var newProductIds = extraShipments
            .Select(es => es.ProductId)
            .Distinct()
            .ToList();

        var productsByPublicId = new Dictionary<Guid, Product>();
        if (newProductIds.Count > 0)
        {
            var fetchedProducts = await dbContext.Products
                .Where(p => newProductIds.Contains(p.PublicId))
                .ToListAsync(ct);

            if (fetchedProducts.Count != newProductIds.Count)
            {
                var notFound = newProductIds.Except(fetchedProducts.Select(p => p.PublicId)).ToList();
                ThrowHelper.PublicEntitiesNotFound(nameof(Product), notFound);
            }

            productsByPublicId = fetchedProducts.ToDictionary(p => p.PublicId);
        }

        var result = new List<OutgoingShipmentInventoryExtraItem>();

        foreach (var dto in extraShipments)
        {
            if (dto.Id is not null && existingById.TryGetValue(dto.Id.Value, out var existing))
            {
                // Update existing item
                existing.Quantity = dto.Quantity;
                existing.IsShipmentLoadingConfirmed = dto.IsLoadingConfirmed;
                existing.FirstInvoiceQuantity = dto.FirstInvoiceQuantity;
                existing.SecondInvoiceQuantity = dto.SecondInvoiceQuantity;
                result.Add(existing);
            }
            else
            {
                // Create new item
                result.Add(new OutgoingShipmentInventoryExtraItem
                {
                    PublicId = Guid.NewGuid(),
                    Product = productsByPublicId[dto.ProductId],
                    IsShipmentLoadingConfirmed = dto.IsLoadingConfirmed,
                    FirstInvoiceQuantity = dto.FirstInvoiceQuantity,
                    SecondInvoiceQuantity = dto.SecondInvoiceQuantity,
                    Quantity = dto.Quantity
                });
            }
        }

        return result;
    }
}