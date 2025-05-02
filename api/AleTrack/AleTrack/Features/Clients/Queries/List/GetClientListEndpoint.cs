using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Queries.List;

/// <summary>
/// Endpoint responsible for handling requests to retrieve a filtered list of clients.
/// </summary>
public sealed class GetClientListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<ClientListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("clients");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetClientListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered client list";
            s.Responses[StatusCodes.Status200OK] = "List of clients";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.Clients
            .Select(c => new ClientListItemDto
            {
                Id = c.PublicId,
                Name = c.Name
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);
        
        await SendAsync(data, cancellation: ct);
    }
}