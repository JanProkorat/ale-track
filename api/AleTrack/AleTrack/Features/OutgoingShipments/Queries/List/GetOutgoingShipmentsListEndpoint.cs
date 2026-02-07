using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Queries.List;

/// <summary>
/// Endpoint responsible for retrieving a filtered list of outgoing shipments.
/// </summary>
/// <param name="dbContext"></param>
public sealed class GetOutgoingShipmentsListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<OutgoingShipmentListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("outgoing-shipments");
        Description(b => b
            .RequireRole(UserRoleType.User)
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

        var outgoingShipments = await dbContext.OutgoingShipments
            .Select(os => new OutgoingShipmentListItemDto
            {
                Id = os.PublicId,
                Name = os.Name,
                State = os.State,
                DeliveryDate = os.DeliveryDate,
                PlanningState = os.PlanningState
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);

        if (planningState is not null)
            outgoingShipments = outgoingShipments.Where(o => o.PlanningState == planningState).ToList();
        
        await SendOkAsync(outgoingShipments, ct);
    }
}