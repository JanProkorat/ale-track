using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.ClientDeliveryPlaces;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Orders.Queries.OutgoingShipmentsList;

public record GetOrdersListForOutgoingShipmentsRequest : FilterableRequest
{
    /// <summary>
    /// ID of the outgoing shipment to retrieve orders for.
    /// </summary>
    public Guid? OutgoingShipmentId { get; set; }
}

/// <summary>
/// Endpoint to get orders to be displayed in outgoing shipment dropdown
/// </summary>
public class GetOrdersListForOutgoingShipmentsEndpoint(AleTrackDbContext dbContext) : Endpoint<GetOrdersListForOutgoingShipmentsRequest, List<OutgoingShipmentOrderDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("outgoing-shipments/orders");
        Description(b => b
            .RequirePermission(ModuleType.Orders, PermissionLevel.View)
            .WithName(nameof(GetOrdersListForOutgoingShipmentsEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered order list for outgoing shipments";
            s.Responses[StatusCodes.Status200OK] = "List of orders for outgoing shipments retrieved";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetOrdersListForOutgoingShipmentsRequest req, CancellationToken ct)
    {
        var data = await dbContext.Orders
            .Where(o => (req.OutgoingShipmentId == null ? o.OutgoingShipmentStop == null : 
                            (o.OutgoingShipmentStop == null || o.OutgoingShipmentStop.OutgoingShipment.PublicId == req.OutgoingShipmentId))
                        && o.State != OrderState.Cancelled)
            .AsNoTracking()
            .Select(o => new OutgoingShipmentOrderDto
            {
                Id = o.PublicId,
                RequiredDeliveryDate = o.RequiredDeliveryDate,
                ClientName = o.Client.Name,
                ClientOfficialAddress = o.Client.OfficialAddress.ToDto(),
                ClientContactAddress = o.Client.ContactAddress != null ? o.Client.ContactAddress.ToDto() : null,
                ClientDeliveryPlaces = o.Client.DeliveryPlaces
                    .Where(p => !p.IsDeleted)
                    .OrderBy(p => p.Name)
                    .Select(p => new ClientDeliveryPlaceDto
                    {
                        Id = p.PublicId,
                        Name = p.Name,
                        Note = p.Note,
                        Address = p.Address.ToDto()
                    })
                    .ToList(),
                DeliveryAddressKind = o.DeliveryAddressKind,
                ClientDeliveryPlaceId = o.ClientDeliveryPlace != null ? o.ClientDeliveryPlace.PublicId : null,
                // Product order per ProductOrdering.
                Items = o.OrderItems
                    .OrderBy(oi => oi.Product.Brewery.DisplayOrder)                    .ThenBy(oi => oi.Product.Type == ProductType.Lemonade
                         || oi.Product.Type == ProductType.Merchandise
                         || oi.Product.Type == ProductType.Other ? 1 : 0)
                    .ThenBy(oi => oi.Product.PlatoDegree == null)
                    .ThenBy(oi => oi.Product.PlatoDegree)
                    .ThenBy(oi => oi.Product.PackageSize)
                    .ThenBy(oi => oi.Product.Name)
                    .Select(oi => new UnassignedOrderItemDto
                    {
                        OrderItemId = oi.PublicId,
                        ProductId = oi.Product.PublicId,
                        ProductName = oi.Product.Name,
                        Quantity = oi.Quantity,
                        Weight = oi.Product.Weight,
                        AlcoholPercentage = oi.Product.AlcoholPercentage,
                        PlatoDegree = oi.Product.PlatoDegree,
                        PackageSize = oi.Product.PackageSize,
                        Kind = oi.Product.Kind,
                        Type = oi.Product.Type,
                        IsShipmentLoadingConfirmed = oi.IsShipmentLoadingConfirmed,
                        BreweryDisplayOrder = oi.Product.Brewery.DisplayOrder,
                        DisplayOrder = oi.Product.DisplayOrder
                    })
                    .ToList()
            })
            .OrderBy(o => o.RequiredDeliveryDate)
            .ThenBy(o => o.ClientName)
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);

        await Send.OkAsync(data, cancellation: ct);
    }
}