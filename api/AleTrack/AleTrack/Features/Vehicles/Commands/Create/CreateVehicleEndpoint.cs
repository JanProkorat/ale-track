using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;

namespace AleTrack.Features.Vehicles.Commands.Create;


/// <summary>
/// Request to create new <see cref="Vehicle"/>
/// </summary>
public sealed record CreateVehicleRequest
{
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateVehicleDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint for creating a new <see cref="Vehicle"/>.
/// </summary>
public sealed class CreateVehicleEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateVehicleRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("vehicles");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateVehicleEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates vehicle";
                s.Responses[StatusCodes.Status201Created] = "Vehicle created";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateVehicleRequest req, CancellationToken ct)
    {
        var vehicle = new Vehicle
        {
            Name = req.Data.Name,
            MaxWeight = req.Data.MaxWeight
        };
        
        dbContext.Vehicles.Add(vehicle);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(vehicle.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}