using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ProductDeliveries.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ProductDeliveries.Commands.Update;

public sealed record UpdateProductDeliveryRequest
{
    /// <summary>
    /// ID of related delivery
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateProductDeliveryDto Data { get; set; } = null!;
}

public sealed class UpdateProductDeliveryEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateProductDeliveryRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("products/deliveries/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateProductDeliveryEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates delivery of brewery products";
                s.Responses[StatusCodes.Status204NoContent] = "Delivery updated";
                s.SetNotFoundResponse("Delivery", "Vehicle");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateProductDeliveryRequest req, CancellationToken ct)
    {
        var delivery = await dbContext.ProductDeliveries
            .Where(d => d.PublicId == req.Id)
            .Include(d => d.Drivers)
            .Include(d => d.Vehicle)
            .Include(d => d.Stops)
                .ThenInclude(d => d.Items)
                    .ThenInclude(d => d.Product)
            .FirstOrDefaultAsync(ct);
        
        if (delivery is null)
            ThrowHelper.PublicEntityNotFound(nameof(ProductDelivery), req.Id);

        if (req.Data.State is not ProductDeliveryState.InPlanning && delivery!.Stops.Count is 0)
            ProductDeliveryThrowHelper.NoItemsToDeliver(req.Data.State);
        
        delivery!.Date = req.Data.DeliveryDate;
        delivery.State = req.Data.State;
        delivery.Note = req.Data.Note;
        
        if (delivery.Vehicle?.PublicId != req.Data.VehicleId)
            delivery.Vehicle = await GetVehicleAsync(req.Data.VehicleId, ct);
        
        delivery.Drivers.Clear();
        delivery.Drivers = await GetDriversAsync(req.Data.DriverIds, ct);

        var requestStopIds = req.Data.Stops
            .Select(s => s.PublicId)
            .ToList();

        // Remove stops that are not in the request
        delivery.Stops.RemoveAll(s => !requestStopIds.Contains(s.PublicId));
        
        var breweries = await GetBreweriesAsync(req.Data.Stops, ct);
        var products = await GetProductsAsync(req.Data.Stops, ct);
        
        // Add new stops that are in the request
        var stopsToAdd = req.Data.Stops
            .Where(s => s.PublicId is null)
            .ToList();
        
        delivery.Stops.AddRange(CreateNewStops(stopsToAdd, breweries, products));
        
        // Update existing stops
        var requestStepsWithUpdatedData = req.Data.Stops
            .Where(s => s.PublicId is not null)
            .ToList();
        
        var stopsToUpdate = delivery.Stops
            .Where(s => requestStepsWithUpdatedData.Any(r => r.PublicId == s.PublicId))
            .ToList();
        
        UpdateDeliveryStops(stopsToUpdate, requestStepsWithUpdatedData, breweries, products);
        
        // When the delivery is finished, fill inventory with the products from the delivery
        if (req.Data.State is ProductDeliveryState.Finished)
            await CreateInventoryItemsAsync(delivery.Stops, ct);
        
        await dbContext.SaveChangesAsync(ct);
        await SendNoContentAsync(ct);
    }

    private async Task CreateInventoryItemsAsync(ICollection<DeliveryStop> deliveryStops, CancellationToken cancellationToken)
    {
        var allDeliveryItems = deliveryStops
            .SelectMany(s => s.Items)
            .ToList();
        
        var deliveryProductIds = allDeliveryItems
            .Select(i => i.Product.Id)
            .Distinct()
            .ToList();
        
        var existingInventoryItemsForProducts = await dbContext.InventoryItems
            .Where(i => i.Product != null && deliveryProductIds.Contains(i.Product.Id))
            .Include(inventoryItem => inventoryItem.Product)
            .ToListAsync(cancellationToken);
        
        var newInventoryItems = new List<InventoryItem>();
        foreach (var item in allDeliveryItems)
        {
            var relatedExistingItemForProduct = existingInventoryItemsForProducts.FirstOrDefault(i => i.Product.Id == item.Product.Id);
            if (relatedExistingItemForProduct is not null)
            {
                relatedExistingItemForProduct.Amount += item.Amount;
                relatedExistingItemForProduct.Note = item.Note;
            }
            else
            {
                relatedExistingItemForProduct = new InventoryItem
                {
                    Amount = item.Amount,
                    Note = item.Note,
                    Product = item.Product,
                };
                
                newInventoryItems.Add(relatedExistingItemForProduct);
            }
        }
        
        if (newInventoryItems.Count > 0)
            dbContext.InventoryItems.AddRange(newInventoryItems);
    }
    
    private static void UpdateDeliveryStops(List<DeliveryStop> stopsToUpdate, List<UpdateProductDeliveryStopDto> requestStepsWithUpdatedData, List<Brewery> breweries, List<Product> products)
    {
        foreach (var stop in stopsToUpdate)
        {
            var relatedRequestStop = requestStepsWithUpdatedData.First(r => r.PublicId == stop.PublicId);
            var relatedBrewery = breweries.First(b => b.PublicId == relatedRequestStop.BreweryId);
            
            stop.Brewery = relatedBrewery;
            stop.Note = relatedRequestStop.Note;
            
            stop.Items.Clear();
            stop.Items = relatedRequestStop.Products
                .Select(p => new DeliveryItem
                {
                    Product = products.First(pr => pr.PublicId == p.ProductId),
                    Amount = p.Quantity,
                    Note = p.Note
                })
                .ToList();
        }
    }

    private static List<DeliveryStop> CreateNewStops(List<UpdateProductDeliveryStopDto> stopsToAdd, List<Brewery> breweries, List<Product> products)
        => stopsToAdd
            .Select(request => new DeliveryStop
            {
                Brewery = breweries.First(b => b.PublicId == request.BreweryId),
                Note = request.Note,
                Items = request.Products
                    .Select(p => new DeliveryItem
                    {
                        Product = products.First(pr => pr.PublicId == p.ProductId),
                        Amount = p.Quantity,
                        Note = p.Note
                    })
                    .ToList()
            })
            .ToList();

    private async Task<List<Product>> GetProductsAsync(List<UpdateProductDeliveryStopDto> stops, CancellationToken cancellationToken)
    {
        var productIds = stops
            .SelectMany(s => s.Products)
            .Select(s => s.ProductId)
            .Distinct()
            .ToList();
        
        var existingProducts = await dbContext.Products
            .Where(p => productIds.Contains(p.PublicId))
            .ToListAsync(cancellationToken);

        if (existingProducts.Count == productIds.Count)
            return existingProducts;
        
        var foundProductIds = existingProducts.Select(p => p.PublicId).ToList();
        var nonExistingProductIds = productIds.Except(foundProductIds).ToList();
        
        ThrowHelper.PublicEntitiesNotFound(nameof(Product), nonExistingProductIds);

        return existingProducts;
    }
    
    private async Task<List<Brewery>> GetBreweriesAsync(List<UpdateProductDeliveryStopDto> requestStops, CancellationToken cancellationToken)
    {
        var breweriesInRequest = requestStops
            .Select(s => s.BreweryId)
            .ToList();
        
        var breweries = await dbContext.Breweries
            .Where(b => breweriesInRequest.Contains(b.PublicId))
            .ToListAsync(cancellationToken);

        if (breweriesInRequest.Count == breweries.Count)
            return breweries;
        
        var foundBreweryIds = breweries.Select(b => b.PublicId).ToList();
        var nonExistingBreweryIds = breweriesInRequest.Except(foundBreweryIds).ToList();
        
        ThrowHelper.PublicEntitiesNotFound(nameof(Brewery), nonExistingBreweryIds);

        return breweries;
    }

    private async Task<Vehicle?> GetVehicleAsync(Guid? vehicleId, CancellationToken cancellationToken)
    {
        if (vehicleId is null)
            return null;
        
        var vehicle = await dbContext.Vehicles.FirstOrDefaultAsync(v => v.PublicId == vehicleId, cancellationToken);
        if (vehicle is null)
            ThrowHelper.PublicEntityNotFound(nameof(Vehicle), vehicleId.Value);
        
        return vehicle!;
    }

    private async Task<List<Driver>> GetDriversAsync(List<Guid> driverIds, CancellationToken cancellationToken)
    {
        if (driverIds.Count == 0)
            return [];
        
        var drivers = await dbContext.Drivers
            .Where(d => driverIds.Contains(d.PublicId))
            .ToListAsync(cancellationToken);

        if (drivers.Count == driverIds.Count)
            return drivers;
        
        var foundDriverIds = drivers.Select(d => d.PublicId).ToList();
        var nonExistingDriverIds = driverIds.Except(foundDriverIds).ToList();
        
        ThrowHelper.PublicEntitiesNotFound(nameof(Driver), nonExistingDriverIds);

        return drivers;
    }
}