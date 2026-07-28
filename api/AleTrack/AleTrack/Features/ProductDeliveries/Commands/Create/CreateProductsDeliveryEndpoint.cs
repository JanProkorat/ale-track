using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using AleTrack.Features.ProductDeliveries.Utils;

namespace AleTrack.Features.ProductDeliveries.Commands.Create;

/// <summary>
/// Request to create delivery of multiple products from a brewery
/// </summary>
public sealed record CreateProductsDeliveryRequest
{
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateProductsDeliveryDto Data { get; set; } = null!;
}

public sealed class CreateProductsDeliveryEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateProductsDeliveryRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("products/deliveries");
        Description(b => b
            .RequirePermission(ModuleType.Deliveries, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateProductsDeliveryEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates delivery of brewery products";
                s.Responses[StatusCodes.Status201Created] = "Delivery created";
                s.SetNotFoundResponse("Brewery, Vehicle, Product");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateProductsDeliveryRequest req, CancellationToken ct)
    {
        
        var vehicle = await GetVehicleAsync(req.Data.VehicleId, ct);
        var drivers = await GetDriversAsync(req.Data.DriverIds, ct);
        var stops = await CreateDeliveryStopsAsync(req.Data.Stops, ct);

        var delivery = new ProductDelivery
        {
            Note = req.Data.Note,
            State = ProductDeliveryState.InPlanning,
            Date = req.Data.DeliveryDate,
            Vehicle = vehicle,
            Drivers = drivers,
            Stops = stops
        };
        
        dbContext.ProductDeliveries.Add(delivery);
        await dbContext.SaveChangesAsync(ct);
        
        await Send.ResponseAsync(delivery.PublicId, StatusCodes.Status201Created, cancellation: ct);
    }

    private async Task<List<DeliveryStop>> CreateDeliveryStopsAsync(List<CreateProductDeliveryStopDto> requestStops, CancellationToken cancellationToken)
    {
        var breweryIds = requestStops
            .Where(s => s.Kind == DeliveryStopKind.Brewery)
            .Select(s => s.BreweryId!.Value)
            .ToList();

        var breweries = await GetBreweriesAsync(breweryIds, cancellationToken);

        var productIds = requestStops
            .SelectMany(s => s.Products)
            .Select(p => p.ProductId)
            .Distinct()
            .ToList();

        var products = await GetProductsAsync(productIds, cancellationToken);

        var deliveryStops = new List<DeliveryStop>();

        foreach (var (requestStop, index) in requestStops.Select((s, i) => (s, i)))
        {
            if (requestStop.Kind == DeliveryStopKind.Custom)
            {
                deliveryStops.Add(new DeliveryStop
                {
                    Order = index,
                    Kind = DeliveryStopKind.Custom,
                    Label = requestStop.Label,
                    Note = requestStop.Note,
                    Latitude = requestStop.Latitude,
                    Longitude = requestStop.Longitude
                });
                continue;
            }

            var relatedProducts = products
                .Where(p => requestStop.Products.Any(dp => dp.ProductId == p.PublicId))
                .ToList();

            deliveryStops.Add(new DeliveryStop
            {
                Order = index,
                Kind = DeliveryStopKind.Brewery,
                Note = requestStop.Note,
                Brewery = breweries.First(b => b.PublicId == requestStop.BreweryId),
                Items = requestStop.Products
                    .Select(p =>
                    {
                        var product = relatedProducts.First(rp => rp.PublicId == p.ProductId);
                        var item = new DeliveryItem
                        {
                            Product = product,
                            Quantity = p.Quantity,
                            Note = p.Note
                        };
                        DeliveryItemSnapshot.Apply(item, product);
                        return item;
                    })
                    .ToList()
            });
        }

        return deliveryStops;
    }

    private async Task<List<Product>> GetProductsAsync(List<Guid> productIds, CancellationToken cancellationToken)
    {
        var existingProducts = await dbContext.Products
            .Where(p => productIds.Contains(p.PublicId) && !p.IsDeleted)
            .ToListAsync(cancellationToken);

        if (existingProducts.Count == productIds.Count)
            return existingProducts;
        
        var foundProductIds = existingProducts.Select(p => p.PublicId).ToList();
        var nonExistingProductIds = productIds.Except(foundProductIds).ToList();
        
        ThrowHelper.PublicEntitiesNotFound(nameof(Product), nonExistingProductIds);

        return existingProducts;
    }

    private async Task<List<Brewery>> GetBreweriesAsync(List<Guid> breweryIds, CancellationToken cancellationToken)
    {
        var existingBreweries = await dbContext.Breweries
            .Where(b => breweryIds.Contains(b.PublicId))
            .ToListAsync(cancellationToken);

        if (existingBreweries.Count == breweryIds.Count)
            return existingBreweries;
        
        var foundBreweryIds = existingBreweries.Select(b => b.PublicId).ToList();
        var nonExistingBreweryIds = breweryIds.Except(foundBreweryIds).ToList();
    
        ThrowHelper.PublicEntitiesNotFound(nameof(Brewery), nonExistingBreweryIds);

        return existingBreweries;
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
    
    private async Task<List<DeliveryItem>> GetDeliveryItemsAsync(List<CreateProductDeliveryItemDto> products, CancellationToken cancellationToken)
    {
        if (products.Count == 0)
            return [];
        
        var productIds = products
            .Select(p => p.ProductId)
            .Distinct()
            .ToList();

        var existingProducts = await dbContext.Products
            .Where(p => productIds.Contains(p.PublicId) && !p.IsDeleted)
            .ToListAsync(cancellationToken);

        if (existingProducts.Count < productIds.Count)
        {
            var foundProductIds = existingProducts.Select(d => d.PublicId).ToList();
            var nonExistingProductIds = productIds.Except(foundProductIds).ToList();
        
            ThrowHelper.PublicEntitiesNotFound(nameof(Product), nonExistingProductIds);
        }
        
        var deliveryItems = new List<DeliveryItem>();
        foreach (var requestProduct in products)
        {
            var relatedProduct = existingProducts.First(p => p.PublicId == requestProduct.ProductId);
            
            var item = new DeliveryItem
            {
                Product = relatedProduct,
                Quantity = requestProduct.Quantity,
                Note = requestProduct.Note
            };
            DeliveryItemSnapshot.Apply(item, relatedProduct);
            deliveryItems.Add(item);
        }
        
        return deliveryItems;
    }
}