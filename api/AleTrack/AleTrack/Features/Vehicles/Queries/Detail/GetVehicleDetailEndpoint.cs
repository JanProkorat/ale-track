using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Vehicles.Queries.Detail;

/// <summary>
/// Represents a request to retrieve details of a specific Vehicle.
/// </summary>
public sealed record GetVehicleDetailRequest
{
    /// <summary>
    /// ID of the Vehicle
    /// </summary>
    public Guid Id { get; set; }
}

public sealed class GetVehicleDetailEndpoint(AleTrackDbContext dbContext) : Endpoint<GetVehicleDetailRequest, VehicleDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("vehicles/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetVehicleDetailEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets Vehicle detail";
            s.Responses[StatusCodes.Status200OK] = "Detail of Vehicle";
            s.SetNotFoundResponse("Vehicle");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetVehicleDetailRequest req, CancellationToken ct)
    {
        var breweries = await dbContext.Vehicles
            .Where(c => c.PublicId == req.Id)
            .Select(c => new VehicleDto
            {
                Id = c.PublicId,
                Name = c.Name,
                MaxWeight = c.MaxWeight
            })
            .FirstOrDefaultAsync(ct);

        if (breweries is null)
            ThrowHelper.PublicEntityNotFound(nameof(Vehicle), req.Id);

        await SendOkAsync(breweries!, ct);
    }
}