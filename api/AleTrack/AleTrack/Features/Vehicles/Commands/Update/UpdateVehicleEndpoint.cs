using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Vehicles.Commands.Update;

/// <summary>
/// Represents a request to update the details of an existing vehicle.
/// </summary>
/// <remarks>
/// This request is designed to be used with the UpdateVehicle endpoint for updating
/// vehicle information. The request body should include the vehicle identifier and
/// the data to be updated.
/// The validation of this request ensures that the provided data conforms to the
/// required format and constraints. Any missing or invalid fields will result in
/// validation errors.
/// </remarks>
public sealed record UpdateVehicleRequest
{
    /// <summary>
    /// ID of the vehicle
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateVehicleDto Data { get; set; } = null!;
}

/// <summary>
/// Represents an endpoint for updating an existing vehicle's information.
/// </summary>
/// <remarks>
/// The UpdateVehicleEndpoint facilitates the modification of vehicle details by handling
/// HTTP PUT requests targeting the specified vehicle's identifier. It validates the
/// incoming data and applies the changes to the vehicle resource in the database.
/// If the vehicle is not found or the data is invalid, appropriate error responses are generated.
/// </remarks>
public sealed class UpdateVehicleEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateVehicleRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("vehicles/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateVehicleEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates vehicle";
                s.Responses[StatusCodes.Status204NoContent] = "Vehicle Updated";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateVehicleRequest req, CancellationToken ct)
    {
        var vehicle = await dbContext.Vehicles.FirstOrDefaultAsync(d => d.PublicId == req.Id, ct);
        if (vehicle is null)
            ThrowHelper.PublicEntityNotFound(nameof(Vehicle), req.Id);
        
        vehicle!.Name = req.Data.Name;
        vehicle.MaxWeight = req.Data.MaxWeight;
        
        await dbContext.SaveChangesAsync(ct);
        await SendNoContentAsync(ct);
    }
}