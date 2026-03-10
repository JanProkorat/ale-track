using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.Users.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reports.Queries;

public sealed class GetNumberOfRecordsInEachModuleEndpoint(AleTrackDbContext dbContext) : EndpointWithoutRequest<NumberOfRecordsInEachModuleDto>
{
    
    private readonly OutgoingShipmentState[] _finishedOutgoingShipments = [
        OutgoingShipmentState.Cancelled,
        OutgoingShipmentState.Delivered
    ];
    
    private readonly OrderState[] _finishedOrderStates = [
        OrderState.Finished,
        OrderState.Cancelled
    ];
    
    private readonly ProductDeliveryState[] _finishedProductDeliveryStates = [
        ProductDeliveryState.Finished,
        ProductDeliveryState.Cancelled
    ];
    
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/number-of-records-in-each-module");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetNumberOfRecordsInEachModuleEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets number of records in each module";
            s.Responses[StatusCodes.Status200OK] = "Dto with number of records in each module";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var result = new NumberOfRecordsInEachModuleDto
        {
            ClientsCount = await dbContext.Clients.CountAsync(ct),
            OrdersCount = await dbContext.Orders.CountAsync(o => !_finishedOrderStates.Contains(o.State), ct),
            BreweriesCount = await dbContext.Breweries.CountAsync(ct),
            DriversCount = await dbContext.Drivers.CountAsync(ct),
            VehiclesCount = await dbContext.Vehicles.CountAsync(ct),
            InventoryItemsCount = await dbContext.InventoryItems.CountAsync(ct),
            UsersCount = await dbContext.Users.CountAsync(u => u.UserName != UserConstants.AdminUserName, ct),
            OutgoingShipmentsCount = await dbContext.OutgoingShipments.CountAsync(o => !_finishedOutgoingShipments.Contains(o.State), ct),
            ProductDeliveriesCount = await dbContext.ProductDeliveries.CountAsync(o => !_finishedProductDeliveryStates.Contains(o.State), ct)
        };

        await Send.OkAsync(result, ct);
    }
}