using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Users.Commands.delete;

/// <summary>
/// Represents a request to delete a user within the application.
/// </summary>
public record DeleteUserRequest
{
    /// <summary>
    /// Public identifier of the user to delete
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Represents the endpoint responsible for handling the deletion of a user.
/// </summary>
/// <remarks>
/// Configures functionality to delete a user by their ID, requiring the caller to have admin-level privileges.
/// This endpoint verifies the existence of the user before deletion and returns appropriate HTTP status codes based on the operation outcome.
/// </remarks>
public sealed class DeleteUserEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteUserRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("users/{id}");
        Description(b => b
            .RequireRole(UserRoleType.Admin)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteUserEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes user";
                s.Responses[StatusCodes.Status202Accepted] = "User deleted";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteUserRequest req, CancellationToken ct)
    {
        var product = await dbContext.Users.FirstOrDefaultAsync(o => o.PublicId == req.Id, ct);
        if (product == null)
            ThrowHelper.PublicEntityNotFound(nameof(User), req.Id);

        dbContext.Users.Remove(product!);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(null, StatusCodes.Status202Accepted, ct);
    }
}