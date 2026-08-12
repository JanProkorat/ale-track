using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Users.Commands.Create;

/// <summary>
/// Represents a request for creating a new user.
/// </summary>
public record CreateUserRequest
{
    /// <summary>
    /// Body of the request containing user data.
    /// </summary>
    [FromBody] 
    public CreateUserDto Data { get; set; } = null!;
}

/// <summary>
/// Represents the endpoint for creating a new user in the system.
/// </summary>
public sealed class CreateUserEndpoint(AleTrackDbContext dbContext, IPasswordHasher passwordHasher) : Endpoint<CreateUserRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("users");
        Description(b => b
            .RequirePermission(ModuleType.Users, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateUserEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates new user";
                s.Responses[StatusCodes.Status201Created] = "User created";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateUserRequest req, CancellationToken ct)
    {
        var user = new User
        {
            FirstName = req.Data.FirstName,
            LastName = req.Data.LastName,
            UserName = req.Data.UserName,
            Password = passwordHasher.HashPassword(req.Data.Password),
            UserRoles = req.Data.UserRoles
                .Select(r => new UserRole
                {
                    Type = r
                })
                .ToList(),
            Permissions = req.Data.Permissions
                .Where(p => p.Level != PermissionLevel.None)
                .Select(p => new UserPermission
                {
                    Module = p.Module,
                    Level = p.Level
                })
                .ToList()
        };
        
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(ct);
        await ApplyDriverLinkAsync(user, req.Data.DriverId, ct);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(user.PublicId.ToString(), StatusCodes.Status201Created, cancellation: ct);
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