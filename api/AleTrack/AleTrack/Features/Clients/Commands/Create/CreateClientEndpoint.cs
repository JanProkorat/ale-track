using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
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
            OfficialAddress = new Address
            {
                StreetName = req.Data.OfficialAddress.StreetName,
                StreetNumber = req.Data.OfficialAddress.StreetNumber,
                City = req.Data.OfficialAddress.City,
                Country = req.Data.OfficialAddress.Country!,
                Zip = req.Data.OfficialAddress.Zip
            },
            ContactAddress = req.Data.ContactAddress is not null ? new Address
            {
                StreetName = req.Data.ContactAddress.StreetName,
                StreetNumber = req.Data.ContactAddress.StreetNumber,
                City = req.Data.ContactAddress.City,
                Country = req.Data.ContactAddress.Country,
                Zip = req.Data.ContactAddress.Zip
            } : null
        };
        
        dbContext.Clients.Add(client);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(client.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}