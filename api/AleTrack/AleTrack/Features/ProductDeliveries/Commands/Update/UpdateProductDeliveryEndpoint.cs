using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ProductDeliveries.Utils;
using AleTrack.Infrastructure.Persistance;
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
            .Include(d => d.Items)
                .ThenInclude(d => d.Product)
            .FirstOrDefaultAsync(ct);
        
        if (delivery is null)
            ThrowHelper.PublicEntityNotFound(nameof(ProductDelivery), req.Id);

        if (req.Data.State is not ProductDeliveryState.InPlanning && delivery!.Items.Count is 0)
            ProductDeliveryThrowHelper.NoItemsToDeliver(req.Data.State);
        
        delivery!.Date = req.Data.DeliveryDate;
        delivery.State = req.Data.State;
        delivery.Note = req.Data.Note;
        delivery.Vehicle = await GetVehicleAsync(req.Data.VehicleId, ct);
        delivery.Drivers = await GetDriversAsync(req.Data.DriverIds, ct);

        if (req.Data.State is ProductDeliveryState.Finished)
            await CreateInventoryItemsAsync(delivery.Items, ct);
        
        await dbContext.SaveChangesAsync(ct);
        await SendNoContentAsync(ct);
    }

    private async Task CreateInventoryItemsAsync(ICollection<DeliveryItem> deliveryItems, CancellationToken cancellationToken)
    {
        var deliveryProductIds = deliveryItems
            .Select(i => i.ProductId)
            .ToList();
        
        var existingInventoryItemsForProducts = await dbContext.InventoryItems
            .Where(i => i.ProductId != null && deliveryProductIds.Contains(i.ProductId.Value))
            .ToListAsync(cancellationToken);
        
        var newInventoryItems = new List<InventoryItem>();
        foreach (var item in deliveryItems)
        {
            var relatedExistingItemForProduct = existingInventoryItemsForProducts.FirstOrDefault(i => i.ProductId == item.ProductId);
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