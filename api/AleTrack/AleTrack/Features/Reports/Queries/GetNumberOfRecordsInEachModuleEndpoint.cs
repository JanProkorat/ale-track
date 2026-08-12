using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.Users.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reports.Queries;

/// <summary>
/// Reports the number of records in each module, but only for the modules the caller may
/// see — this endpoint stays authenticated-only (it powers sidebar badges and dashboard
/// tiles for every user), so the per-module permission check happens inside
/// <see cref="HandleAsync"/> instead of at the route.
/// </summary>
public sealed class GetNumberOfRecordsInEachModuleEndpoint(AleTrackDbContext dbContext, IAppContext appContext)
    : EndpointWithoutRequest<NumberOfRecordsInEachModuleDto>
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
            .RequireAuthenticated()
            .WithName(nameof(GetNumberOfRecordsInEachModuleEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets number of records in each module";
            s.Responses[StatusCodes.Status200OK] = "Dto with number of records in each module the caller may see";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var result = new NumberOfRecordsInEachModuleDto
        {
            ClientsCount = CanSee(ModuleType.Clients)
                ? await dbContext.Clients.CountAsync(ct)
                : null,
            OrdersCount = CanSee(ModuleType.Orders)
                ? await dbContext.Orders.CountAsync(o => !_finishedOrderStates.Contains(o.State), ct)
                : null,
            BreweriesCount = CanSee(ModuleType.Breweries)
                ? await dbContext.Breweries.CountAsync(ct)
                : null,
            DriversCount = CanSee(ModuleType.Drivers)
                ? await dbContext.Drivers.CountAsync(ct)
                : null,
            VehiclesCount = CanSee(ModuleType.Vehicles)
                ? await dbContext.Vehicles.CountAsync(ct)
                : null,
            InventoryItemsCount = CanSee(ModuleType.Inventory)
                ? await dbContext.InventoryItems.SumAsync(c => c.Quantity, ct)
                : null,
            UsersCount = CanSee(ModuleType.Users)
                ? await dbContext.Users.CountAsync(u => u.UserName != UserConstants.AdminUserName, ct)
                : null,
            OutgoingShipmentsCount = CanSee(ModuleType.Shipments)
                ? await dbContext.OutgoingShipments.CountAsync(o => !_finishedOutgoingShipments.Contains(o.State), ct)
                : null,
            ProductDeliveriesCount = CanSee(ModuleType.Deliveries)
                ? await dbContext.ProductDeliveries.CountAsync(o => !_finishedProductDeliveryStates.Contains(o.State), ct)
                : null
        };

        await Send.OkAsync(result, ct);
    }

    /// <summary>
    /// Whether the caller may see <paramref name="module"/> at all. A module the caller cannot
    /// open reports no count, so the dashboard cannot be used to infer how much data exists.
    /// </summary>
    /// <param name="module">Module the count belongs to.</param>
    private bool CanSee(ModuleType module)
        => appContext.Permissions.TryGetValue(module, out var level) && level >= PermissionLevel.View;
}
