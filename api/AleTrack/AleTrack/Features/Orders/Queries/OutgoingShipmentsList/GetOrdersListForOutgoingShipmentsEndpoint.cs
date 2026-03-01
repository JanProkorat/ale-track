using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
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
            .RequireRole(UserRoleType.User)
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
                Items = o.OrderItems
                    .Select(oi => new UnassignedOrderItemDto
                    {
                        ProductId = oi.Product.PublicId,
                        ProductName = oi.Product.Name,
                        Quantity = oi.Quantity,
                        Weight = oi.Product.Weight,
                        AlcoholPercentage = oi.Product.AlcoholPercentage,
                        PlatoDegree = oi.Product.PlatoDegree,
                        PackageSize = oi.Product.PackageSize,
                        Kind = oi.Product.Kind,
                        Type = oi.Product.Type
                    })
                    .OrderBy(oi => oi.ProductName)
                    .ToList()
            })
            .OrderBy(o => o.RequiredDeliveryDate)
            .ThenBy(o => o.ClientName)
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);

        await SendOkAsync(data, cancellation: ct);
    }
}