using AleTrack.Common.Utils;
using Moq;

namespace AleTrack.Tests.Mocks;

/// <summary>
/// Test doubles for <see cref="IDriverScope"/>, covering the three states every scoped
/// endpoint has to handle: an ordinary caller, a linked driver, and a driver whose
/// account has no driver record.
/// </summary>
public static class DriverScopeMockFactory
{
    /// <summary>
    /// A caller who is not a driver — admin or manager. Scoping is a no-op.
    /// </summary>
    public static IDriverScope Unscoped()
    {
        var mock = new Mock<IDriverScope>();
        mock.Setup(s => s.IsScoped).Returns(false);
        mock.Setup(s => s.GetDriverIdAsync(It.IsAny<CancellationToken>())).ReturnsAsync((long?)null);
        return mock.Object;
    }

    /// <summary>
    /// A driver account linked to the driver record with the given internal id.
    /// </summary>
    /// <param name="driverId">Internal id of the linked driver record.</param>
    public static IDriverScope Scoped(long driverId)
    {
        var mock = new Mock<IDriverScope>();
        mock.Setup(s => s.IsScoped).Returns(true);
        mock.Setup(s => s.GetDriverIdAsync(It.IsAny<CancellationToken>())).ReturnsAsync(driverId);
        return mock.Object;
    }

    /// <summary>
    /// A driver account with no driver record linked. Must see nothing.
    /// </summary>
    public static IDriverScope ScopedUnlinked()
    {
        var mock = new Mock<IDriverScope>();
        mock.Setup(s => s.IsScoped).Returns(true);
        mock.Setup(s => s.GetDriverIdAsync(It.IsAny<CancellationToken>())).ReturnsAsync((long?)null);
        return mock.Object;
    }
}
