using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;

namespace AleTrack.Features.Clients.Commands.Create;

/// <summary>
/// Request to create new <see cref="Client"/>
/// </summary>
public sealed record CreateClientRequest
{
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateClientDto Data { get; set; } = null!;
}

public sealed class CreateClientEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateClientRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("clients");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateClientEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates client";
                s.Responses[StatusCodes.Status201Created] = "Client created";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateClientRequest req, CancellationToken ct)
    {
        var client = new Client
        {
            Name = req.Data.Name,
            StreetName = req.Data.Address.StreetName,
            StreetNumber = req.Data.Address.StreetNumber,
            City = req.Data.Address.City,
            Country = req.Data.Address.Country,
            Zip = req.Data.Address.Zip
        };
        
        dbContext.Clients.Add(client);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(client.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}