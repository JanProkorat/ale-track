using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using Moq;

namespace AleTrack.Tests.Mocks;

/// <summary>
/// Test doubles for <see cref="IAppContext"/>, for the endpoints that stamp who did something.
/// </summary>
public static class AppContextMockFactory
{
    /// <summary>
    /// A caller the endpoint cannot name — no user claim. Whatever is written gets no author,
    /// which is what an unauthenticated or service call looks like.
    /// </summary>
    public static IAppContext Anonymous()
    {
        var mock = new Mock<IAppContext>();
        mock.SetupGet(a => a.UserId).Returns((Guid?)null);
        mock.SetupGet(a => a.UserName).Returns((string?)null);
        mock.SetupGet(a => a.Roles).Returns([]);
        return mock.Object;
    }

    /// <summary>
    /// A named caller, so what they write can be attributed to them.
    /// </summary>
    /// <param name="userPublicId">Public ID of the acting user.</param>
    public static IAppContext For(Guid userPublicId)
    {
        var mock = new Mock<IAppContext>();
        mock.SetupGet(a => a.UserId).Returns(userPublicId);
        mock.SetupGet(a => a.Roles).Returns([UserRoleType.Manager]);
        return mock.Object;
    }
}
