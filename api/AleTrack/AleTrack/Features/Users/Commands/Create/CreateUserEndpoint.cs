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
        var driver = await LoadDriverForLinkingAsync(req.Data.DriverId, ct);

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

        // Assign through the navigation, not the FK: the user's id is store-generated and does
        // not exist until SaveChangesAsync, so setting driver.UserId here would capture a
        // temporary value. EF writes the real key when it inserts the user.
        if (driver is not null)
        {
            driver.User = user;
        }

        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(user.PublicId.ToString(), StatusCodes.Status201Created, cancellation: ct);
    }

    /// <summary>
    /// Loads and validates the driver to link to a newly created account. A brand-new account can
    /// never already own a driver, so unlike the update endpoint there is no "previously linked
    /// driver" to release here.
    /// </summary>
    /// <param name="driverPublicId">Driver to link, or null when the new account has no driver link.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The tracked driver to link, or null when no driver was requested.</returns>
    private async Task<Driver?> LoadDriverForLinkingAsync(Guid? driverPublicId, CancellationToken ct)
    {
        if (driverPublicId is null)
        {
            return null;
        }

        var driver = await dbContext.Drivers.FirstOrDefaultAsync(d => d.PublicId == driverPublicId, ct);
        if (driver is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Driver), driverPublicId.Value);
        }

        if (driver!.UserId is not null)
        {
            ThrowHelper.DriverAlreadyLinkedToUser(driverPublicId.Value);
        }

        return driver;
    }
}