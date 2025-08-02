using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Vehicles.Commands.Delete;

/// <summary>
/// Represents the request used to delete a vehicle entity.
/// </summary>
public sealed record DeleteVehicleRequest
{
    /// <summary>
    /// ID of the vehicle
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Handles the endpoint responsible for deleting Vehicle entities.
/// </summary>
public sealed class DeleteVehicleEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteVehicleRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("vehicles/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .WithName(nameof(DeleteVehicleEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes vehicle";
                s.Responses[StatusCodes.Status202Accepted] = "Vehicle deleted";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteVehicleRequest req, CancellationToken ct)
    {
        var vehicle = await dbContext.Vehicles.FirstOrDefaultAsync(d => d.PublicId == req.Id, ct);
        if (vehicle is null)
            ThrowHelper.PublicEntityNotFound(nameof(vehicle), req.Id);
        
        dbContext.Vehicles.Remove(vehicle!);
        await dbContext.SaveChangesAsync(ct);
        await SendAsync(null, StatusCodes.Status202Accepted, ct);
    }
}