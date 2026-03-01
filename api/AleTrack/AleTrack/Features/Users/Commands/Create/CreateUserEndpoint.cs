using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;

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
            .RequireRole(UserRoleType.Admin)
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
                .ToList()
        };
        
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(user.PublicId.ToString(), StatusCodes.Status201Created, cancellation: ct);
    }
}