using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Users.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Users;

public sealed class UpdateUserTests
{
    [Fact]
    public async Task ProcessAsync_UpdateUser_Success()
    {
        var userId = Guid.NewGuid();
        var user = UserBuilder.BuildEntity(
            publicId: userId,
            firstName: "Old",
            lastName: "Name",
            userName: "olduser",
            userRoles: [new UserRole { Type = UserRoleType.User }]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(users: [user]);
        var passwordHasher = new Mock<IPasswordHasher>();

        var command = new UpdateUserRequest
        {
            Id = userId,
            Data = UserBuilder.BuildUpdateDto(
                firstName: "Updated",
                lastName: "User",
                userRoles: [UserRoleType.Admin, UserRoleType.User]
            )
        };

        var endpoint = EndpointBuilder<UpdateUserRequest, UpdateUserEndpoint>.Create(dbContext.Object, passwordHasher.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        // Verify that the user entity was updated with correct values
        user.FirstName.Should().Be(command.Data.FirstName);
        user.LastName.Should().Be(command.Data.LastName);
        user.UserRoles.Count.Should().Be(command.Data.UserRoles.Count);
        
        foreach (var expectedRole in command.Data.UserRoles)
        {
            user.UserRoles.Should().Contain(r => r.Type == expectedRole);
        }
        
        dbContext.Verify(e => e.Users.Update(It.IsAny<User>()), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_UpdateUser_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        var passwordHasher = new Mock<IPasswordHasher>();

        var command = new UpdateUserRequest
        {
            Id = Guid.NewGuid(),
            Data = UserBuilder.BuildUpdateDto()
        };

        var endpoint = EndpointBuilder<UpdateUserRequest, UpdateUserEndpoint>.Create(dbContext.Object, passwordHasher.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
