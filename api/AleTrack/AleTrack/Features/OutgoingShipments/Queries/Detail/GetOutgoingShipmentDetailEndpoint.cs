using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Queries.Detail;

/// <summary>
/// Request to get details of an outgoing shipment
/// </summary>
public sealed record GetOutgoingShipmentDetailRequest
{
    /// <summary>
    /// ID of the outgoing shipment to retrieve details for
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint responsible for retrieving details of an outgoing shipment.
/// </summary>
/// <param name="dbContext"></param>
public sealed class GetOutgoingShipmentDetailEndpoint(AleTrackDbContext dbContext) : Endpoint<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("outgoing-shipments/{Id:guid}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<OutgoingShipmentDetailDto>(StatusCodes.Status200OK)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetOutgoingShipmentDetailEndpoint)));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Retrieves details of an existing outgoing shipment";
                s.Responses[StatusCodes.Status200OK] = "Outgoing shipment details retrieved";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetOutgoingShipmentDetailRequest req, CancellationToken ct)
    {
        var outgoingShipment = await dbContext.OutgoingShipments
            .Where(os => os.PublicId == req.Id)
            .Select(os => new OutgoingShipmentDetailDto
            {
                Id = os.PublicId,
                State = os.State,
                DeliveryDate = os.DeliveryDate,
                VehicleId = os.Vehicle != null ? os.Vehicle.PublicId : null,
                DriverIds = os.Drivers
                    .Select(d => d.Driver.PublicId)
                    .ToList(),
                Stops = os.Stops
                    .Select(s => new OutgoingShipmentStopDto
                    {
                        Order = s.Order,
                        ClientId = s.ClientOrder.Client.PublicId,
                        ClientName = s.ClientOrder.Client.Name,
                        OfficialAddress = s.ClientOrder.Client.OfficialAddress.ToDto(),
                        ContactAddress = s.ClientOrder.Client.ContactAddress != null 
                            ? s.ClientOrder.Client.ContactAddress.ToDto()
                            : null,
                        OrderId = s.ClientOrder.PublicId,
                        Products = s.ClientOrder.OrderItems
                            .Select(oi => new OutgoingShipmentProductDto
                            {
                                Id = oi.Product.PublicId,
                                Name = oi.Product.Name,
                                Quantity = oi.Quantity,
                                Kind = oi.Product.Kind,
                                Type = oi.Product.Type,
                                AlcoholPercentage = oi.Product.AlcoholPercentage,
                                PlatoDegree = oi.Product.PlatoDegree,
                                PackageSize = oi.Product.PackageSize
                            })
                            .ToList()
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (outgoingShipment is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        await SendAsync(outgoingShipment!, cancellation: ct);
    }
}