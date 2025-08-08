using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Users.Commands.Update;

/// <summary>
/// Represents a request for creating a new user.
/// </summary>
public record UpdateUserRequest
{
    /// <summary>
    /// ID of the user
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request containing user data.
    /// </summary>
    [FromBody] 
    public UpdateUserDto Data { get; set; } = null!;
}

/// <summary>
/// Represents the endpoint for creating a new user in the system.
/// </summary>
public sealed class UpdateUserEndpoint(AleTrackDbContext dbContext, IPasswordHasher passwordHasher) : Endpoint<UpdateUserRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("users/{id}");
        Description(b => b
            .RequireRole(UserRoleType.Admin)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateUserEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates a user";
                s.Responses[StatusCodes.Status204NoContent] = "User updated";
                s.SetNotFoundResponse("User");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateUserRequest req, CancellationToken ct)
    {
        var user = await dbContext.Users
            .Where(u => u.PublicId == req.Id)
            .Include(u => u.UserRoles)
            .FirstOrDefaultAsync(ct);
        
        if (user is null)
            ThrowHelper.PublicEntityNotFound(nameof(User), req.Id);
        
        user!.FirstName = req.Data.FirstName;
        user.LastName = req.Data.LastName;
        
        user.UserRoles.Clear();
        user.UserRoles = req.Data.UserRoles
            .Select(r => new UserRole
            {
                Type = r
            })
            .ToList();
        
        dbContext.Users.Update(user);
        await dbContext.SaveChangesAsync(ct);
        
        await SendNoContentAsync(ct);
    }
}