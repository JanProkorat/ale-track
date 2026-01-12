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
    /// States in which the OutgoingShipment can have null data
    /// </summary>
    private readonly OutgoingShipmentState[] statesWithAllowedNullData = [
        OutgoingShipmentState.Cancelled, 
        OutgoingShipmentState.Created
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
    override public async Task HandleAsync(UpdateOutgoingShipmentRequest req, CancellationToken ct)
    {
        var outgoingShipment = await dbContext.OutgoingShipments
        .Include(os => os.Drivers)
        .Include(os => os.Vehicle)
        .Include(os => os.Stops)
            .ThenInclude(s => s.Order)
        .FirstOrDefaultAsync(os => os.PublicId == req.Id, ct);

        if (outgoingShipment is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        var drivers = await GetDriversAsync(req.Data.DriverIds, outgoingShipment!, ct);
        var vehicle = await GetVehicleAsync(req.Data.VehicleId, outgoingShipment!, ct);
        var stops = await GetOrderStopsAsync(req.Data.ClientOrderShipments, outgoingShipment!, ct);

        outgoingShipment!.DeliveryDate = req.Data.DeliveryDate;
        outgoingShipment.Vehicle = vehicle;
        outgoingShipment.Drivers = drivers;
        outgoingShipment.Stops = stops;

        if (!statesWithAllowedNullData.Contains(req.Data.State) && !outgoingShipment.HasFilledData)
            ThrowHelper.ShipmentNotPrepared(req.Data.State);
        
        outgoingShipment.State = req.Data.State;

        await dbContext.SaveChangesAsync(ct);

        await SendNoContentAsync(ct);
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
                .Select(o => new OutgoingShipmentStop
                {
                    ClientOrder = o,
                    Order = clientOrderShipments.First(cos => cos.ClientOrderId == o.PublicId).Order
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
}