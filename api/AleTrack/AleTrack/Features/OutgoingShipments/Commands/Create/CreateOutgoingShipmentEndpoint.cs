using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

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
/// <param name="companyOptions"></param>
/// <param name="driverScope"></param>
public sealed class CreateOutgoingShipmentEndpoint(
    AleTrackDbContext dbContext, IOptions<CompanyOptions> companyOptions, IDriverScope driverScope)
    : Endpoint<CreateOutgoingShipmentRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("outgoing-shipments");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
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
    public override async Task HandleAsync(CreateOutgoingShipmentRequest req, CancellationToken ct)
    {
        // Planning shipments is office work; a driver only executes the ones assigned to them.
        if (driverScope.IsScoped)
        {
            ThrowHelper.DriverScopeForbidden();
        }

        var company = companyOptions.Value;

        var drivers = await GetDriversAsync(req.Data.DriverIds, ct);
        var vehicle = await GetVehicleAsync(req.Data.VehicleId, ct);
        var orders = await GetOrdersAsync(req.Data.ClientOrderShipments, ct);
        var placeIds = await ShipmentStopDeliveryPlaceResolver.ResolveAsync(dbContext, req.Data.ClientOrderShipments, alreadyReferencedPlaceIds: null, ct);
        var startBrewery = await GetStartBreweryAsync(req.Data.StartPointKind, req.Data.StartBreweryId, req.Data.StartBreweryAddressKind, ct);

        var outgoingShipment = new OutgoingShipment
        {
            Name = req.Data.Name,
            DeliveryDate = req.Data.DeliveryDate,
            CreatedDate = DateTime.UtcNow,
            State = OutgoingShipmentState.Created,
            Vehicle = vehicle,
            StartPointKind = req.Data.StartPointKind,
            StartBrewery = startBrewery,
            StartBreweryId = startBrewery?.Id,
            StartBreweryAddressKind = req.Data.StartBreweryAddressKind,
            Drivers = [.. drivers
                .Select(d => new OutgoingShipmentDriver 
                {
                    Driver = d
                })],
            Stops = [
                .. req.Data.ClientOrderShipments
                    .Select(cos =>
                    {
                        var order = orders.First(o => o.PublicId == cos.ClientOrderId);
                        var stop = new OutgoingShipmentStop
                        {
                            Kind = OutgoingShipmentStopKind.Order,
                            ClientOrder = order,
                            Order = cos.Order,
                            SelectedAddressKind = cos.SelectedAddressKind,
                            ClientDeliveryPlaceId = cos.ClientDeliveryPlaceId.HasValue
                                ? placeIds[cos.ClientDeliveryPlaceId.Value]
                                : null
                        };

                        // Derived, never sent: a stale client-supplied flag would silently
                        // disable propagation from the order.
                        stop.DeriveAddressOverride(order);

                        return stop;
                    }),
                .. req.Data.CustomStops
                    .Select(cs =>
                    {
                        var isCompany = cs.Kind == OutgoingShipmentStopKind.Company;
                        return new OutgoingShipmentStop
                        {
                            Kind = cs.Kind,
                            Order = cs.Order,
                            Label = isCompany ? company.Name : cs.Label,
                            Note = cs.Note,
                            Latitude = isCompany ? company.Latitude : cs.Latitude,
                            Longitude = isCompany ? company.Longitude : cs.Longitude
                        };
                    })
            ],
            RouteViaPoints = [.. req.Data.RouteViaPoints
                .Select((p, i) => new OutgoingShipmentRoutePoint { Order = i, Latitude = p.Latitude, Longitude = p.Longitude })],
            PreparationSteps = [.. req.Data.PreparationSteps
                .Select(s => new OutgoingShipmentPreparationStep
                {
                    PublicId = Guid.NewGuid(),
                    Order = s.Order,
                    Label = s.Label,
                    IsDone = false
                })]
        };

        // Orders added to a shipment move into planning.
        foreach (var order in orders.Where(o => o.State == OrderState.New))
            order.State = OrderState.Planning;

        // A created shipment is always Created, so the content is always open —
        // no mutability gate needed here.
        CompanyStopReconciler.Apply(outgoingShipment, company);

        dbContext.OutgoingShipments.Add(outgoingShipment);
        await dbContext.SaveChangesAsync(ct);
        await Send.ResponseAsync(outgoingShipment.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
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