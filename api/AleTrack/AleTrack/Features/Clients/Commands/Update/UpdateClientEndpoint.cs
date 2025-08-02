using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Commands.Update;

/// <summary>
/// Request to update <see cref="Client"/>
/// </summary>
public sealed record UpdateClientRequest
{
    /// <summary>
    /// Public ID of the client
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateClientDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint to handle the update operation for a <see cref="Client"/> entity.
/// </summary>
public sealed class UpdateClientEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateClientRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateClientEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates client";
                s.Responses[StatusCodes.Status204NoContent] = "Client Updated";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateClientRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients.FirstOrDefaultAsync(c => c.PublicId == req.Id, ct);
        if (client == null)
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.Id);

        client!.Name = req.Data.Name;
        client.OfficialAddress = new Address
        {
            StreetName = req.Data.OfficialAddress.StreetName,
            StreetNumber = req.Data.OfficialAddress.StreetNumber,
            City = req.Data.OfficialAddress.City,
            Country = req.Data.OfficialAddress.Country,
            Zip = req.Data.OfficialAddress.Zip
        };

        if (req.Data.ContactAddress is not null)
        {
            client.ContactAddress = new Address
            {
                StreetName = req.Data.ContactAddress.StreetName,
                StreetNumber = req.Data.ContactAddress.StreetNumber,
                City = req.Data.ContactAddress.City,
                Country = req.Data.ContactAddress.Country,
                Zip = req.Data.ContactAddress.Zip
            };
        }
        
        await dbContext.SaveChangesAsync(ct);
        await SendNoContentAsync(ct);
    }
}