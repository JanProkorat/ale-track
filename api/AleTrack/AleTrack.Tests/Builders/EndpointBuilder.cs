using AleTrack.Tests.Mocks;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;

namespace AleTrack.Tests.Builders;

/// <summary>
/// Provides functionality to construct instances of an endpoint for testing purposes
/// while setting up the necessary dependencies.
/// </summary>
/// <typeparam name="TRequest">The type of the request model that the endpoint processes.</typeparam>
/// <typeparam name="TEndpoint">The type of the endpoint that will process the request.</typeparam>
public static class EndpointBuilder<TRequest, TEndpoint> where TEndpoint : Endpoint<TRequest> where TRequest : notnull
{
    /// <summary>
    /// Creates an instance of the specified endpoint type and configures it with the required dependencies.
    /// </summary>
    /// <param name="dependencies">
    /// An array of dependencies to be provided for the endpoint during its creation. These dependencies
    /// will be resolved and passed to the endpoint instance.
    /// </param>
    /// <returns>
    /// An instance of the endpoint of type <typeparamref name="TEndpoint"/> configured with the specified dependencies.
    /// </returns>
    public static TEndpoint Create(params object?[] dependencies)
    {
        return Factory.Create<TEndpoint>(context =>
        {
            context.AddTestServices(s => s.AddSingleton(LinkGeneratorMockFactory.CreateLinkGenerator()));
        }, dependencies);
    }
}