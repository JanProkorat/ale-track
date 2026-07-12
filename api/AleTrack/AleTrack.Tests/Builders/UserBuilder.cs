using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Users.Commands.Create;
using AleTrack.Features.Users.Commands.Login;
using AleTrack.Features.Users.Commands.Update;

namespace AleTrack.Tests.Builders;

public static class UserBuilder
{
    public static User BuildEntity(
        Guid? publicId = null,
        string? firstName = null,
        string? lastName = null,
        string? userName = null,
        string? password = null,
        List<UserRole>? userRoles = null)
    {
        return new User
        {
            PublicId = publicId ?? Guid.NewGuid(),
            FirstName = firstName ?? "John",
            LastName = lastName ?? "Doe",
            UserName = userName ?? "testuser",
            Password = password ?? "hashedpassword123",
            UserRoles = userRoles ?? 
            [
                new UserRole { Type = UserRoleType.User }
            ]
        };
    }

    public static CreateUserDto BuildCreateDto(
        string? firstName = null,
        string? lastName = null,
        string? userName = null,
        string? password = null,
        List<UserRoleType>? userRoles = null)
    {
        return new CreateUserDto
        {
            FirstName = firstName ?? "Test",
            LastName = lastName ?? "User",
            UserName = userName ?? "testuser",
            Password = password ?? "testpassword123",
            UserRoles = userRoles ?? [UserRoleType.User]
        };
    }

    public static UpdateUserDto BuildUpdateDto(
        string? firstName = null,
        string? lastName = null,
        List<UserRoleType>? userRoles = null)
    {
        return new UpdateUserDto
        {
            FirstName = firstName ?? "Updated",
            LastName = lastName ?? "User",
            UserRoles = userRoles ?? [UserRoleType.Admin]
        };
    }

    public static LoginUserDto BuildLoginDto(
        string? userName = null,
        string? password = null)
    {
        return new LoginUserDto
        {
            UserName = userName ?? "testuser",
            Password = password ?? "testpassword123"
        };
    }
}
