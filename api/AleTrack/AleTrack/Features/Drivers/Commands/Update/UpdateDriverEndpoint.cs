using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Drivers.Commands.Update;

/// <summary>
/// Represents the request model for updating an existing driver.
/// Contains the unique identifier of the driver and the data to be updated.
/// </summary>
public sealed record UpdateDriverRequest
{
    /// <summary>
    /// ID of the driver
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateDriverDto Data { get; set; } = null!;
}

/// <summary>
/// Represents the endpoint responsible for handling driver update requests.
/// It processes the incoming request to update an existing driver's details
/// and ensures the driver record is persisted with the updated data in the database.
/// </summary>
public sealed class UpdateDriverEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateDriverRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("drivers/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateDriverEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates driver";
                s.Responses[StatusCodes.Status204NoContent] = "Driver Updated";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateDriverRequest req, CancellationToken ct)
    {
        var driver = await dbContext.Drivers
            .Where(d => d.PublicId == req.Id)
            .Include(d => d.Availabilities)
            .FirstOrDefaultAsync(ct);
        
        if (driver is null)
            ThrowHelper.PublicEntityNotFound(nameof(Driver), req.Id);
        
        driver!.FirstName = req.Data.FirstName;
        driver.LastName = req.Data.LastName;
        driver.PhoneNumber = req.Data.PhoneNumber;
        driver.Color = req.Data.Color;
        driver.Availabilities = req.Data.AvailableDates
            .Select(d => new DriverAvailability
            {
                From = d.From.ToLocalTime(),
                Until = d.Until.ToLocalTime()
            })
            .ToList();
        
        await dbContext.SaveChangesAsync(ct);
        await SendNoContentAsync(ct);
    }
}