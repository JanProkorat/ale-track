using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Users.Queries.List;

public sealed class GetUserListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<UserListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("users");
        Description(b => b
            .RequireRole(UserRoleType.Admin)
            .WithName(nameof(GetUserListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered user list";
            s.Responses[StatusCodes.Status200OK] = "List of users";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.Users
            .Select(u => new UserListItemDto
            {
                Id = u.PublicId,
                FirstName = u.FirstName,
                LastName = u.LastName,
                UserName = u.UserName,
                UserRoles = u.UserRoles
                    .Select(r => r.Type)
                    .ToList()
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);
        
        await SendAsync(data, cancellation: ct);
    }
}