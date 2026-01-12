using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.Create;

/// <summary>
/// Request model for creating a new outgoing shipment
/// </summary>
public record CreateOutgoingShipmentRequest
{
    /// <summary>
    /// Data for creating a new outgoing shipment
    /// </summary>
    [FromBody]
    public CreateOutgoingShipmentDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint for creating a new outgoing shipment
/// </summary>
/// <param name="dbContext"></param>
public sealed class CreateOutgoingShipmentEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateOutgoingShipmentRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("outgoing-shipments");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateOutgoingShipmentEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates new outgoing shipment";
                s.Responses[StatusCodes.Status201Created] = "Outgoing shipment created";
                s.Responses[StatusCodes.Status404NotFound] = "Vehicle, drivers or orders not found";
            }
        );
    }

    /// <inheritdoc />
    override public async Task HandleAsync(CreateOutgoingShipmentRequest req, CancellationToken ct)
    {
        var drivers = await GetDriversAsync(req.Data.DriverIds, ct);
        var vehicle = await GetVehicleAsync(req.Data.VehicleId, ct);
        var orders = await GetOrdersAsync(req.Data.ClientOrderShipments, ct);

        var outgoingShipment = new OutgoingShipment
        {
            DeliveryDate = req.Data.DeliveryDate,
            State = OutgoingShipmentState.Created,
            Vehicle = vehicle,
            Drivers = [.. drivers
                .Select(d => new OutgoingShipmentDriver 
                {
                    Driver = d
                })],
            Stops = [.. req.Data.ClientOrderShipments
                .OrderBy(cos => cos.Order)
                .Select(cos => new OutgoingShipmentStop
                {
                    ClientOrder = orders.First(o => o.PublicId == cos.ClientOrderId),
                    Order = cos.Order
                })]
        };

        dbContext.OutgoingShipments.Add(outgoingShipment);
        await dbContext.SaveChangesAsync(ct);
        await SendAsync(outgoingShipment.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }

    private async Task<List<Entities.Order>> GetOrdersAsync(List<ClientOrderShipmentDto> clientOrderShipments, CancellationToken ct)
    {
        if (clientOrderShipments.Count == 0)
            return [];

        var orderIds = clientOrderShipments
            .Select(cos => cos.ClientOrderId)
            .ToList();

        var orders = await dbContext.Orders
            .Where(o => orderIds.Contains(o.PublicId))
            .Include(o => o.OutgoingShipmentStop)
            .ToListAsync(ct);

        if (orders.Count != orderIds.Count)
        {
            var foundOrderIds = orders.Select(o => o.PublicId).ToHashSet();
            var notFoundOrderIds = orderIds.Where(id => !foundOrderIds.Contains(id)).ToList();
            ThrowHelper.PublicEntitiesNotFound(nameof(Entities.Order), notFoundOrderIds);
        }

        var ordersAlreadyAssignedIds = orders
            .Where(o => o.OutgoingShipmentStop is not null)
            .Select(o => o.PublicId)
            .ToList();

        if (ordersAlreadyAssignedIds.Count > 0)
            ThrowHelper.OrderAlreadyAssignedToOutgoingShipment(ordersAlreadyAssignedIds);        

        return orders;
    }

    private async Task<Vehicle?> GetVehicleAsync(Guid? vehicleId, CancellationToken ct)
    {
        if (vehicleId is null)
            return null;

        var vehicle = await dbContext.Vehicles
            .FirstOrDefaultAsync(v => v.PublicId == vehicleId, ct);

        if (vehicle is null)
            ThrowHelper.PublicEntityNotFound(nameof(Vehicle), vehicleId.Value);

        return vehicle;
    }

    private async Task<List<Driver>> GetDriversAsync(List<Guid> driverIds, CancellationToken ct)
    {
        if (driverIds.Count == 0)
            return [];

        var drivers = await dbContext.Drivers
            .Where(d => driverIds.Contains(d.PublicId))
            .ToListAsync(ct);

        if (drivers.Count != driverIds.Count)
        {
            var foundDriverIds = drivers.Select(d => d.PublicId).ToHashSet();
            var notFoundDriverIds = driverIds.Where(id => !foundDriverIds.Contains(id)).ToList();
            ThrowHelper.PublicEntitiesNotFound(nameof(Driver), notFoundDriverIds);
        }

        return drivers;
    }
}