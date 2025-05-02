using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Drivers.Commands.Delete;

/// <summary>
/// Represents the request used to delete a driver entity.
/// </summary>
public sealed record DeleteDriverRequest
{
    /// <summary>
    /// ID of the driver
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Handles the endpoint responsible for deleting driver entities.
/// </summary>
public sealed class DeleteDriverEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteDriverRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("drivers/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .WithName(nameof(DeleteDriverEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes driver";
                s.Responses[StatusCodes.Status202Accepted] = "Driver deleted";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteDriverRequest req, CancellationToken ct)
    {
        var driver = await dbContext.Drivers.FirstOrDefaultAsync(d => d.PublicId == req.Id, ct);
        if (driver is null)
            ThrowHelper.PublicEntityNotFound(nameof(Driver), req.Id);
        
        dbContext.Drivers.Remove(driver!);
        await dbContext.SaveChangesAsync(ct);
        await SendAsync(null, StatusCodes.Status202Accepted, ct);
    }
}