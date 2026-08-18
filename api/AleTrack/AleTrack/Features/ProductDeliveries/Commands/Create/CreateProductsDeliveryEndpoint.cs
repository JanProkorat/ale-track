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
        var sources = requestStops.Select(ToSource).ToList();
        var catalog = await DeliverySourceCatalog.LoadAsync(dbContext, sources, cancellationToken);

        var deliveryStops = new List<DeliveryStop>();

        // The list position is the stop's Order.
        for (var index = 0; index < requestStops.Count; index++)
        {
            var requestStop = requestStops[index];
            var source = sources[index];

            var stop = new DeliveryStop
            {
                Order = index,
                Kind = source.Kind,
                Note = requestStop.Note
            };

            switch (source.Kind)
            {
                case DeliveryStopKind.Custom:
                    stop.Label = requestStop.Label;
                    stop.Latitude = requestStop.Latitude;
                    stop.Longitude = requestStop.Longitude;
                    break;

                case DeliveryStopKind.Brewery:
                    stop.Brewery = catalog.Brewery(source.BreweryId!.Value);
                    stop.Items = source.Lines.Select(l => catalog.BuildItem(source, l)).ToList();
                    break;

                case DeliveryStopKind.Supplier:
                    stop.Supplier = catalog.Supplier(source.SupplierId!.Value);
                    stop.Items = source.Lines.Select(l => catalog.BuildItem(source, l)).ToList();
                    break;
            }

            deliveryStops.Add(stop);
        }

        return deliveryStops;
    }

    private static DeliveryStopSource ToSource(CreateProductDeliveryStopDto stop) => new(
        stop.Kind,
        stop.BreweryId,
        stop.SupplierId,
        stop.Products
            .Select(p => new DeliveryLineSource(p.ProductId, p.SupplierGoodId, p.ChargeKind, p.Quantity, p.Note))
            .ToList());

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