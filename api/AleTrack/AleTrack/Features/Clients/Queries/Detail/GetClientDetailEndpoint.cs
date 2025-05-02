using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Queries.Detail;

/// <summary>
/// Request to get detail of the client
/// </summary>
public sealed record GetClientDetailRequest
{
    /// <summary>
    /// ID of the client
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to handle requests for retrieving client details based on a unique identifier.
/// </summary>
public sealed class GetClientDetailEndpoint(AleTrackDbContext dbContext) : Endpoint<GetClientDetailRequest, ClientDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("clients/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetClientDetailEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets client detail";
            s.Responses[StatusCodes.Status200OK] = "Detail of client";
            s.SetNotFoundResponse("Client");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientDetailRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .Where(c => c.PublicId == req.Id)
            .Select(c => new ClientDto
            {
                Id = c.PublicId,
                City = c.City,
                Country = c.Country,
                Name = c.Name,
                Zip = c.Zip,
                StreetName = c.StreetName,
                StreetNumber = c.StreetNumber
            })
            .FirstOrDefaultAsync(ct);
        
        if (client == null)
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.Id);

        await SendOkAsync(client!, ct);
    }
}