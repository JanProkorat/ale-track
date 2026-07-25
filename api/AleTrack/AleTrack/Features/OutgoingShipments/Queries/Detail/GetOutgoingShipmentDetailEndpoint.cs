using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Orders.Utils;
using AleTrack.Features.OutgoingShipments.Utils;
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
            .RequirePermission(ModuleType.Shipments, PermissionLevel.View)
            .Produces<OutgoingShipmentDetailDto>()
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
                Name = os.Name,
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
                        Id = s.PublicId,
                        Kind = s.Kind,
                        Order = s.Order,
                        ClientId = s.ClientOrder != null ? s.ClientOrder.Client.PublicId : null,
                        ClientName = s.ClientOrder != null ? s.ClientOrder.Client.Name : null,
                        OfficialAddress = s.ClientOrder != null ? s.ClientOrder.Client.OfficialAddress.ToDto() : null,
                        ContactAddress = s.ClientOrder != null && s.ClientOrder.Client.ContactAddress != null
                            ? s.ClientOrder.Client.ContactAddress.ToDto()
                            : null,
                        OrderId = s.ClientOrder != null ? s.ClientOrder.PublicId : null,
                        SelectedAddressKind = s.SelectedAddressKind,
                        Label = s.Label,
                        Note = s.Note,
                        Latitude = s.Latitude,
                        Longitude = s.Longitude,
                        Products = s.ClientOrder != null
                            ? s.ClientOrder.OrderItems
                                .OrderBy(oi => oi.Product.Brewery.DisplayOrder)
                                .Select(oi => new OutgoingShipmentOrderItemDto
                                {
                                    Id = oi.Product.PublicId,
                                    Name = oi.Product.Name,
                                    Quantity = oi.Quantity,
                                    Kind = oi.Product.Kind,
                                    PackageSize = oi.Product.PackageSize,
                                    Weight = oi.Product.Weight,
                                    OrderItemId = oi.PublicId,
                                    QuantityFromInventory = oi.QuantityFromInventory,
                                    InventoryItemId = oi.InventoryItem != null ? oi.InventoryItem.PublicId : null,
                                    InventoryItemName = oi.InventoryItem != null
                                        ? (oi.InventoryItem.Name ?? (oi.InventoryItem.Product != null ? oi.InventoryItem.Product.Name : null))
                                        : null,
                                    InventoryItemAvailable = oi.InventoryItem != null ? oi.InventoryItem.Quantity : null
                                })
                                .ToList()
                            : new List<OutgoingShipmentOrderItemDto>(),
                        Returns = s.ClientOrder != null
                            ? s.ClientOrder.Returns
                                .Select(r => new OrderReturnDto
                                {
                                    Id = r.PublicId,
                                    Name = r.Name,
                                    Quantity = r.Quantity,
                                    Note = r.Note
                                })
                                .ToList()
                            : new List<OrderReturnDto>(),
                        CustomExtraItems = s.ClientOrder != null
                            ? s.ClientOrder.CustomExtraItems
                                .Select(e => new OrderCustomExtraItemDto
                                {
                                    Id = e.PublicId,
                                    Description = e.Description,
                                    Quantity = e.Quantity,
                                    IsLoadingConfirmed = e.IsShipmentLoadingConfirmed
                                })
                                .ToList()
                            : new List<OrderCustomExtraItemDto>()
                    })
                    .ToList(),
                RouteViaPoints = os.RouteViaPoints
                    .OrderBy(v => v.Order)
                    .Select(v => new RoutePointDto { Latitude = v.Latitude, Longitude = v.Longitude })
                    .ToList(),
                InventoryExtraItems = os.InventoryExtraItems
                    .Select(ei => new OutgoingShipmentInventoryExtraItemDto
                    {
                        Id = ei.PublicId,
                        Quantity = ei.Quantity,
                        Kind = ei.Product.Kind,
                        PackageSize = ei.Product.PackageSize,
                        IsShipmentLoadingConfirmed = ei.IsShipmentLoadingConfirmed,
                        ProductId = ei.Product.PublicId,
                        Name = ei.Product.Name
                    })
                    .ToList(),
            })
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        if (outgoingShipment is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        await Send.OkAsync(outgoingShipment, cancellation: ct);
    }
}