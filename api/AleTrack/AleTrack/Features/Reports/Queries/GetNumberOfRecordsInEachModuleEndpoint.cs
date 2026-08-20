using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Users.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reports.Queries;

/// <summary>
/// Reports the number of records in each module, but only for the modules the caller may
/// see — this endpoint stays authenticated-only (it powers sidebar badges and dashboard
/// tiles for every user), so the per-module permission check happens inside
/// <see cref="HandleAsync"/> instead of at the route. On top of that permission gate, a
/// driver-scoped caller's <see cref="NumberOfRecordsInEachModuleDto.DriversCount"/> and
/// <see cref="NumberOfRecordsInEachModuleDto.OutgoingShipmentsCount"/> are additionally
/// row-scoped to their own driver record and assigned shipments, mirroring
/// <see cref="AleTrack.Features.Drivers.Queries.List.GetDriversListEndpoint"/> and
/// <see cref="AleTrack.Features.OutgoingShipments.Queries.List.GetOutgoingShipmentsListEndpoint"/>
/// so the sidebar badge can never contradict the list it sits next to.
/// </summary>
public sealed class GetNumberOfRecordsInEachModuleEndpoint(
    AleTrackDbContext dbContext,
    IAppContext appContext,
    IDriverScope driverScope)
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
        // Resolved once — GetDriverIdAsync is memoized per request, but the point of
        // resolving it up front (rather than inside each count expression) is to make it
        // obvious this is a single fixed value shared by both scoped counts below.
        var scopedDriverId = driverScope.IsScoped ? await driverScope.GetDriverIdAsync(ct) : null;

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
                ? await CountDriversAsync(scopedDriverId, ct)
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
                ? await CountOutgoingShipmentsAsync(scopedDriverId, ct)
                : null,
            ProductDeliveriesCount = CanSee(ModuleType.Deliveries)
                ? await dbContext.ProductDeliveries.CountAsync(o => !_finishedProductDeliveryStates.Contains(o.State), ct)
                : null,
            // Completed is the only terminal sale state — there is no storno — so "unfinished"
            // covers both a draft and a sale still waiting for its invoice to be paid.
            SalesCount = CanSee(ModuleType.Sales)
                ? await dbContext.Sales.CountAsync(s => s.State != SaleState.Completed, ct)
                : null,
            SuppliersCount = CanSee(ModuleType.Suppliers)
                ? await dbContext.Suppliers.CountAsync(ct)
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

    /// <summary>
    /// Counts driver records, row-scoped to the caller's own driver record when driver-scoped.
    /// A driver-scoped caller with no linked driver record matches nothing (fail-closed), never
    /// the fleet total.
    /// </summary>
    /// <param name="scopedDriverId">The caller's linked driver id, or null when unlinked.</param>
    /// <param name="ct">Cancellation token.</param>
    private async Task<int> CountDriversAsync(long? scopedDriverId, CancellationToken ct)
    {
        IQueryable<Driver> drivers = dbContext.Drivers;

        if (driverScope.IsScoped)
        {
            drivers = drivers.Where(d => d.Id == scopedDriverId);
        }

        return await drivers.CountAsync(ct);
    }

    /// <summary>
    /// Counts unfinished outgoing shipments, row-scoped to shipments the caller is assigned to
    /// when driver-scoped. A driver-scoped caller with no linked driver record matches nothing
    /// (fail-closed), never the fleet total.
    /// </summary>
    /// <param name="scopedDriverId">The caller's linked driver id, or null when unlinked.</param>
    /// <param name="ct">Cancellation token.</param>
    private async Task<int> CountOutgoingShipmentsAsync(long? scopedDriverId, CancellationToken ct)
    {
        IQueryable<OutgoingShipment> outgoingShipments = dbContext.OutgoingShipments;

        if (driverScope.IsScoped)
        {
            outgoingShipments = outgoingShipments.Where(os => os.Drivers.Any(d => d.DriverId == scopedDriverId));
        }

        return await outgoingShipments.CountAsync(o => !_finishedOutgoingShipments.Contains(o.State), ct);
    }
}
