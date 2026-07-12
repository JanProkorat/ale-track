using Microsoft.AspNetCore.Routing;
using Moq;

namespace AleTrack.Tests.Mocks;

/// <summary>
/// A static factory class for creating mock instances of the LinkGenerator class using Moq.
/// </summary>
public static class LinkGeneratorMockFactory
{
    public static LinkGenerator CreateLinkGenerator()
    {
        return new Mock<LinkGenerator>().Object;
    }
}
