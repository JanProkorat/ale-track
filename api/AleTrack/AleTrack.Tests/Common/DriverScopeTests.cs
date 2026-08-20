using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Common;

public sealed class DriverScopeTests
{
    [Fact]
    public void IsScoped_DriverRole_IsTrue()
    {
        var scope = new DriverScope(AppContext([UserRoleType.Driver], Guid.NewGuid()).Object,
            AleTrackDbContextMockFactory.CreateMock().Object);

        scope.IsScoped.Should().BeTrue();
    }

    [Fact]
    public void IsScoped_AdminWithDriverRole_IsFalse()
    {
        var scope = new DriverScope(
            AppContext([UserRoleType.Driver, UserRoleType.Admin], Guid.NewGuid()).Object,
            AleTrackDbContextMockFactory.CreateMock().Object);

        scope.IsScoped.Should().BeFalse();
    }

    [Fact]
    public void IsScoped_ManagerRole_IsFalse()
    {
        var scope = new DriverScope(AppContext([UserRoleType.Manager], Guid.NewGuid()).Object,
            AleTrackDbContextMockFactory.CreateMock().Object);

        scope.IsScoped.Should().BeFalse();
    }

    [Fact]
    public async Task GetDriverIdAsync_LinkedDriver_ReturnsDriverId()
    {
        var userId = Guid.NewGuid();
        var user = UserBuilder.BuildEntity(publicId: userId);
        user.Id = 7;
        var driver = DriverBuilder.BuildEntity(id: 42, user: user);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(users: [user], drivers: [driver]);
        var scope = new DriverScope(AppContext([UserRoleType.Driver], userId).Object, dbContext.Object);

        (await scope.GetDriverIdAsync(CancellationToken.None)).Should().Be(42);
    }

    [Fact]
    public async Task GetDriverIdAsync_NoLinkedDriver_ReturnsNull()
    {
        var userId = Guid.NewGuid();
        var dbContext = AleTrackDbContextMockFactory.CreateMock(drivers: [DriverBuilder.BuildEntity(id: 42)]);
        var scope = new DriverScope(AppContext([UserRoleType.Driver], userId).Object, dbContext.Object);

        (await scope.GetDriverIdAsync(CancellationToken.None)).Should().BeNull();
    }

    private static Mock<IAppContext> AppContext(List<UserRoleType> roles, Guid userId)
    {
        var appContext = new Mock<IAppContext>();
        appContext.Setup(a => a.Roles).Returns(roles);
        appContext.Setup(a => a.UserId).Returns(userId);
        return appContext;
    }
}
