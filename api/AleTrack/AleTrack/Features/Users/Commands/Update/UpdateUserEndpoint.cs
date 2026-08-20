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
            .RequirePermission(ModuleType.Users, PermissionLevel.Edit)
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
            .Include(u => u.Permissions)
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

        user.Permissions.Clear();
        user.Permissions = req.Data.Permissions
            .Where(p => p.Level != PermissionLevel.None)
            .Select(p => new UserPermission
            {
                Module = p.Module,
                Level = p.Level
            })
            .ToList();

        await ApplyDriverLinkAsync(user, req.Data.DriverId, ct);

        dbContext.Users.Update(user);
        await dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Points <paramref name="driverPublicId"/> at <paramref name="user"/> and releases any
    /// driver previously linked to that account, so one account never owns two driver records.
    /// </summary>
    /// <param name="user">Account being saved.</param>
    /// <param name="driverPublicId">Driver to link, or null to unlink.</param>
    /// <param name="ct">Cancellation token.</param>
    private async Task ApplyDriverLinkAsync(User user, Guid? driverPublicId, CancellationToken ct)
    {
        var previous = await dbContext.Drivers.FirstOrDefaultAsync(d => d.UserId == user.Id, ct);

        if (driverPublicId is null)
        {
            if (previous is not null)
            {
                previous.UserId = null;
            }

            return;
        }

        var driver = await dbContext.Drivers.FirstOrDefaultAsync(d => d.PublicId == driverPublicId, ct);
        if (driver is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Driver), driverPublicId.Value);
        }

        if (driver!.UserId is not null && driver.UserId != user.Id)
        {
            ThrowHelper.DriverAlreadyLinkedToUser(driverPublicId.Value);
        }

        if (previous is not null && previous.Id != driver.Id)
        {
            previous.UserId = null;
        }

        driver.UserId = user.Id;
    }
}