using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Queries.List;

/// <summary>
/// Endpoint responsible for retrieving a filtered list of outgoing shipments.
/// </summary>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
public sealed class GetOutgoingShipmentsListEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<FilterableRequest, List<OutgoingShipmentListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("outgoing-shipments");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.View)
            .Produces<List<OutgoingShipmentListItemDto>>(StatusCodes.Status200OK)
            .WithName(nameof(GetOutgoingShipmentsListEndpoint)));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Retrieves a filtered list of existing outgoing shipments";
                s.Responses[StatusCodes.Status200OK] = "Outgoing shipments list retrieved";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var planningState = req.Parameters.GetPlanningState();

        IQueryable<OutgoingShipment> query = dbContext.OutgoingShipments;

        // A driver sees only the shipments they are assigned to. Unlinked accounts match
        // nothing, so they see none rather than all.
        if (driverScope.IsScoped)
        {
            var scopedDriverId = await driverScope.GetDriverIdAsync(ct);
            query = query.Where(os => os.Drivers.Any(d => d.DriverId == scopedDriverId));
        }

        // Newest-created first by default; an explicit "sort" parameter still wins,
        // because ApplyFilterAndSort re-orders the query when one is supplied.
        var outgoingShipments = await query
            .OrderByDescending(os => os.CreatedDate)
            .Select(os => new OutgoingShipmentListItemDto
            {
                Id = os.PublicId,
                Name = os.Name,
                State = os.State,
                DeliveryDate = os.DeliveryDate,
                CreatedDate = os.CreatedDate,
                PlanningState = os.PlanningState
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);

        if (planningState is not null)
            outgoingShipments = outgoingShipments.Where(o => o.PlanningState == planningState).ToList();
        
        await Send.OkAsync(outgoingShipments, ct);
    }
}