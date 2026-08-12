using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Drivers.Queries.List;

public sealed class GetDriversListEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope) : Endpoint<FilterableRequest, List<DriverListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("drivers");
        Description(b => b
            .RequirePermission(ModuleType.Drivers, PermissionLevel.View)
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
        IQueryable<Driver> query = dbContext.Drivers;

        // A driver sees only themselves. An unlinked driver account matches no row and
        // therefore sees nothing, rather than falling back to the full list.
        if (driverScope.IsScoped)
        {
            var scopedDriverId = await driverScope.GetDriverIdAsync(ct);
            query = query.Where(d => d.Id == scopedDriverId);
        }

        var data = await query
            .Select(c => new DriverListItemDto
            {
                Id = c.PublicId,
                FirstName = c.FirstName,
                LastName = c.LastName,
                PhoneNumber = c.PhoneNumber,
                Color = c.Color,
                IsLinkedToUser = c.UserId != null,
                AvailableDates = c.Availabilities
                    .Select(a => new DriverAvailabilityListItemDto(a.From, a.Until))
                    .ToList()

            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);

        await Send.OkAsync(data, cancellation: ct);
    }
}