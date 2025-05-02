using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

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
            .RequireRole(UserRoleType.User)
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
        var brewery = await GetBreweryAsync(req.Data.BreweryId, ct);
        var vehicle = await GetVehicleAsync(req.Data.VehicleId, ct);
        var drivers = await GetDriversAsync(req.Data.DriverIds, ct);
        var deliveryItems = await GetDeliveryItemsAsync(req.Data.Products, ct);

        var delivery = new ProductDelivery
        {
            Note = req.Data.Note,
            Brewery = brewery,
            State = ProductDeliveryState.InPlanning,
            Date = req.Data.DeliveryDate,
            Vehicle = vehicle,
            Drivers = drivers,
            Items = deliveryItems
        };
        
        dbContext.ProductDeliveries.Add(delivery);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(delivery.PublicId, StatusCodes.Status201Created, cancellation: ct);
    }

    private async Task<Brewery> GetBreweryAsync(Guid breweryId, CancellationToken cancellationToken)
    {
        var brewery = await dbContext.Breweries.FirstOrDefaultAsync(b => b.PublicId == breweryId, cancellationToken);
        if (brewery is null)
            ThrowHelper.PublicEntityNotFound(nameof(Brewery), breweryId);

        return brewery!;
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
    
    private async Task<List<DeliveryItem>> GetDeliveryItemsAsync(List<ProductDeliveryItemDto> products, CancellationToken cancellationToken)
    {
        if (products.Count == 0)
            return [];
        
        var productIds = products
            .Select(p => p.ProductId)
            .Distinct()
            .ToList();

        var existingProducts = await dbContext.Products
            .Where(p => productIds.Contains(p.PublicId))
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
            
            deliveryItems.Add(new DeliveryItem
            {
                Product = relatedProduct,
                Amount = requestProduct.Quantity,
                Note = requestProduct.Note
            });
        }
        
        return deliveryItems;
    }
}