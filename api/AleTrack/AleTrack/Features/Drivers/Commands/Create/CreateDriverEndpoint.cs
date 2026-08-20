using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;

namespace AleTrack.Features.Drivers.Commands.Create;

/// <summary>
/// Represents the request object for creating a new driver.
/// Contains the data required to create a driver.
/// </summary>
public sealed record CreateDriverRequest
{
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateDriverDto Data { get; set; } = null!;
}

public sealed class CreateDriverEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope) : Endpoint<CreateDriverRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("drivers");
        Description(b => b
            .RequirePermission(ModuleType.Drivers, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateDriverEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates driver";
                s.Responses[StatusCodes.Status201Created] = "Driver created";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateDriverRequest req, CancellationToken ct)
    {
        // Drivers do not manage the fleet roster — office staff do.
        if (driverScope.IsScoped)
        {
            ThrowHelper.DriverScopeForbidden();
        }

        var driver = new Driver
        {
            FirstName = req.Data.FirstName,
            LastName = req.Data.LastName,
            PhoneNumber = req.Data.PhoneNumber,
            Color = req.Data.Color,
            Availabilities = req.Data.AvailableDates
                .Select(d => new DriverAvailability
                {
                    From = d.From,
                    Until = d.Until
                })
                .ToList()
        };

        dbContext.Drivers.Add(driver);
        await dbContext.SaveChangesAsync(ct);
        
        await Send.ResponseAsync(driver.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}