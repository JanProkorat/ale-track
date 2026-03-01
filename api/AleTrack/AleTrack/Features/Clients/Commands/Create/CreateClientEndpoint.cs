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

/// <summary>
/// Endpoint to create a new <see cref="Client"/>.
/// </summary>
/// <param name="dbContext"></param>
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
            BusinessName = req.Data.BusinessName,
            Region = req.Data.Region,
            OfficialAddress = req.Data.OfficialAddress.ToDbEntity(),
            ContactAddress = req.Data.ContactAddress?.ToDbEntity(),
            Contacts = req.Data.Contacts
                .Select(c => new ClientContact
                {
                    Description = c.Description,
                    Type = c.Type,
                    Value = c.Value
                })
                .ToList()
        };
        
        dbContext.Clients.Add(client);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(client.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}