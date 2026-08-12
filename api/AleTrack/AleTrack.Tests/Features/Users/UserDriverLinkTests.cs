using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Users.Commands.Update;
using AleTrack.Features.Users.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace AleTrack.Tests.Features.Users;

public sealed class UserDriverLinkTests
{
    [Fact]
    public void Validate_DriverIdWithoutDriverRole_FailsWithCorrectCode()
    {
        var request = new UpdateUserRequest
        {
            Id = Guid.NewGuid(),
            Data = new UpdateUserDto
            {
                UserRoles = [UserRoleType.Manager],
                Permissions = [],
                DriverId = Guid.NewGuid()
            }
        };

        var result = new UpdateUserValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor("Data.DriverId")
            .WithErrorCode(UserErrorCodes.DriverLinkRequiresDriverRole);
    }

    [Fact]
    public void Validate_DriverIdWithDriverRole_Passes()
    {
        var request = new UpdateUserRequest
        {
            Id = Guid.NewGuid(),
            Data = new UpdateUserDto
            {
                UserRoles = [UserRoleType.Driver],
                Permissions = [],
                DriverId = Guid.NewGuid()
            }
        };

        var result = new UpdateUserValidator().TestValidate(request);

        result.ShouldNotHaveValidationErrorFor("Data.DriverId");
    }

    [Fact]
    public async Task HandleAsync_DriverAlreadyLinkedToAnotherUser_Fails()
    {
        var otherUser = UserBuilder.BuildEntity();
        otherUser.Id = 9;
        var driverId = Guid.NewGuid();
        var driver = DriverBuilder.BuildEntity(id: 5, publicId: driverId, user: otherUser);

        var target = UserBuilder.BuildEntity();
        target.Id = 3;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            users: [otherUser, target], drivers: [driver]);

        var endpoint = EndpointBuilder<UpdateUserRequest, UpdateUserEndpoint>
            .Create(dbContext.Object, PasswordHasherMock());

        var act = async () => await endpoint.HandleAsync(new UpdateUserRequest
        {
            Id = target.PublicId,
            Data = new UpdateUserDto
            {
                UserRoles = [UserRoleType.Driver],
                Permissions = [],
                DriverId = driverId
            }
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.DriverAlreadyLinkedToUser);
    }

    [Fact]
    public async Task HandleAsync_UnknownDriverId_IsNotFound()
    {
        var target = UserBuilder.BuildEntity();
        target.Id = 3;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(users: [target]);

        var endpoint = EndpointBuilder<UpdateUserRequest, UpdateUserEndpoint>
            .Create(dbContext.Object, PasswordHasherMock());

        var act = async () => await endpoint.HandleAsync(new UpdateUserRequest
        {
            Id = target.PublicId,
            Data = new UpdateUserDto
            {
                UserRoles = [UserRoleType.Driver],
                Permissions = [],
                DriverId = Guid.NewGuid()
            }
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_RoleChangedAwayFromDriver_ClearsTheLink()
    {
        var target = UserBuilder.BuildEntity();
        target.Id = 3;
        var driver = DriverBuilder.BuildEntity(id: 5, user: target);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(users: [target], drivers: [driver]);

        var endpoint = EndpointBuilder<UpdateUserRequest, UpdateUserEndpoint>
            .Create(dbContext.Object, PasswordHasherMock());

        await endpoint.HandleAsync(new UpdateUserRequest
        {
            Id = target.PublicId,
            Data = new UpdateUserDto
            {
                UserRoles = [UserRoleType.Manager],
                Permissions = [],
                DriverId = null
            }
        }, CancellationToken.None);

        driver.UserId.Should().BeNull();
    }

    private static IPasswordHasher PasswordHasherMock()
        => new Moq.Mock<IPasswordHasher>().Object;
}
