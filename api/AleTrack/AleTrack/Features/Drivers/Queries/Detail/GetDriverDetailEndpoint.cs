using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Drivers.Queries.Detail;

/// <summary>
/// Represents a request to retrieve detailed information about a driver.
/// </summary>
public sealed record GetDriverDetailRequest
{
    /// <summary>
    /// ID of the driver
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to handle requests for retrieving detailed information about a driver.
/// </summary>
public sealed class GetDriverDetailEndpoint(AleTrackDbContext dbContext) : Endpoint<GetDriverDetailRequest, DriverDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("drivers/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetDriverDetailEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets driver detail";
            s.Responses[StatusCodes.Status200OK] = "Detail of driver";
            s.SetNotFoundResponse("Driver");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetDriverDetailRequest req, CancellationToken ct)
    {
        var breweries = await dbContext.Drivers
            .Where(c => c.PublicId == req.Id)
            .Select(c => new DriverDto
            {
                Id = c.PublicId,
                FirstName = c.FirstName,
                LastName = c.LastName,
                PhoneNumber = c.PhoneNumber,
                Color = c.Color,
                AvailableDates = c.Availabilities
                    .Select(a => new DriverAvailabilityDto(a.From, a.Until))
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (breweries is null)
            ThrowHelper.PublicEntityNotFound(nameof(Driver), req.Id);

        await SendOkAsync(breweries!, ct);
    }
}