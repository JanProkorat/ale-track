using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Vehicles.Queries.List;

/// <summary>
/// Endpoint for retrieving a filtered list of vehicles.
/// </summary>
/// <remarks>
/// This endpoint fetches a list of vehicles based on the provided filters and sorting parameters.
/// The response contains a list of <see cref="VehicleListItemDto"/> objects, each representing a vehicle with its basic details like ID, name, and maximum weight.
/// </remarks>
/// <param name="dbContext">Database context to query the vehicles data.</param>
public sealed class GetVehiclesListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<VehicleListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("vehicles");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetVehiclesListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered vehicle list";
            s.Responses[StatusCodes.Status200OK] = "List of vehicles";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.Vehicles
            .Select(c => new VehicleListItemDto
            {
                Id = c.PublicId,
                Name = c.Name,
                MaxWeight = c.MaxWeight,
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);
        
        await SendAsync(data, cancellation: ct);
    }
}