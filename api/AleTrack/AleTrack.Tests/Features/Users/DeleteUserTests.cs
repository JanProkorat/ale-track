using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Users.Commands.Delete;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Users;

public sealed class DeleteUserTests
{
    [Fact]
    public async Task ProcessAsync_DeleteUser_Success()
    {
        var userId = Guid.NewGuid();
        var currentUserId = Guid.NewGuid(); // Different from the user being deleted
        var user = UserBuilder.BuildEntity(publicId: userId);
        
        var dbContext = AleTrackDbContextMockFactory.CreateMock(users: [user]);
        var appContext = new Mock<IAppContext>();
        appContext.Setup(a => a.UserId).Returns(currentUserId);

        var command = new DeleteUserRequest
        {
            Id = userId
        };

        var endpoint = EndpointBuilder<DeleteUserRequest, DeleteUserEndpoint>.Create(dbContext.Object, appContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Users.Remove(It.IsAny<User>()), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_DeleteUser_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        var appContext = new Mock<IAppContext>();

        var command = new DeleteUserRequest
        {
            Id = Guid.NewGuid()
        };

        var endpoint = EndpointBuilder<DeleteUserRequest, DeleteUserEndpoint>.Create(dbContext.Object, appContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
    
    [Fact]
    public async Task ProcessAsync_DeleteUser_CannotDeleteSelf()
    {
        var userId = Guid.NewGuid();
        var user = UserBuilder.BuildEntity(publicId: userId);
        
        var dbContext = AleTrackDbContextMockFactory.CreateMock(users: [user]);
        var appContext = new Mock<IAppContext>();
        appContext.Setup(a => a.UserId).Returns(userId); // Same ID as the user being deleted

        var command = new DeleteUserRequest
        {
            Id = userId
        };

        var endpoint = EndpointBuilder<DeleteUserRequest, DeleteUserEndpoint>.Create(dbContext.Object, appContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
        
        // Verify that no deletion occurred
        dbContext.Verify(e => e.Users.Remove(It.IsAny<User>()), Times.Never);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
