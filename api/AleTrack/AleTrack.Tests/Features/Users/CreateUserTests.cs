using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Users.Commands.Create;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using Moq;

namespace AleTrack.Tests.Features.Users;

public sealed class CreateUserTests
{
    [Fact]
    public async Task ProcessAsync_CreateUser_Success()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        var passwordHasher = new Mock<IPasswordHasher>();
        var hashedPassword = "hashed_password_123";
        passwordHasher.Setup(p => p.HashPassword(It.IsAny<string>())).Returns(hashedPassword);
        
        var command = new CreateUserRequest
        {
            Data = UserBuilder.BuildCreateDto(
                firstName: "Test",
                lastName: "User",
                userName: "testuser",
                password: "plainpassword",
                userRoles: [UserRoleType.User, UserRoleType.Admin]
            )
        };

        var endpoint = EndpointBuilder<CreateUserRequest, CreateUserEndpoint>.Create(dbContext.Object, passwordHasher.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);
        
        dbContext.Verify(e => e.Users.Add(It.Is<User>(u => 
            u.FirstName == command.Data.FirstName &&
            u.LastName == command.Data.LastName &&
            u.UserName == command.Data.UserName &&
            u.Password == hashedPassword &&
            u.UserRoles.Count == command.Data.UserRoles.Count &&
            u.UserRoles.All(role => command.Data.UserRoles.Contains(role.Type))
        )), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        passwordHasher.Verify(p => p.HashPassword(command.Data.Password), Times.Once);
    }
}
