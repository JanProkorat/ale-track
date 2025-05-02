using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Drivers.Queries.List;

public sealed class GetDriversListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<DriverListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("drivers");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetDriversListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered driver list";
            s.Responses[StatusCodes.Status200OK] = "List of drivers";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.Drivers
            .Select(c => new DriverListItemDto
            {
                Id = c.PublicId,
                FirstName = c.FirstName,
                LastName = c.LastName
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);
        
        await SendAsync(data, cancellation: ct);
    }
}