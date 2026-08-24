using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using AleTrack.Features.Clients.Commands.Ledger.Delete;
using AleTrack.Features.Clients.Commands.Ledger.Resolution;
using AleTrack.Features.Clients.Commands.Ledger.Save;
using AleTrack.Features.Clients.Commands.Ledger.Update;
using AleTrack.Features.Clients.Queries.Ledger;
using FastEndpoints;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// The ledger rides on <see cref="ModuleType.Clients"/> — reads need View, writes need Edit —
/// and a driver therefore cannot record a deviation; the dispatcher they phone does.
/// </summary>
/// <remarks>
/// Asserted against the authorization metadata the endpoint actually declares, not against the
/// source text. A guard that silently stops being declared is exactly the kind of regression
/// this project has already had once, and nothing about it fails to compile.
/// </remarks>
public sealed class ClientLedgerPermissionTests
{
    [Theory]
    [InlineData(typeof(GetClientLedgerEntriesEndpoint), PermissionLevel.View)]
    [InlineData(typeof(SaveClientLedgerEntriesEndpoint), PermissionLevel.Edit)]
    [InlineData(typeof(UpdateClientLedgerEntryEndpoint), PermissionLevel.Edit)]
    [InlineData(typeof(DeleteClientLedgerEntryEndpoint), PermissionLevel.Edit)]
    [InlineData(typeof(SetClientLedgerEntryResolutionEndpoint), PermissionLevel.Edit)]
    public void Endpoint_RequiresTheClientsModuleAtTheRightLevel(Type endpointType, PermissionLevel level)
    {
        DeclaredPolicies(endpointType)
            .Should().Contain(ModulePermissionRequirement.PolicyName(ModuleType.Clients, level));
    }

    /// <summary>
    /// A read-only caller must not reach any of the writes.
    /// </summary>
    [Theory]
    [InlineData(typeof(SaveClientLedgerEntriesEndpoint))]
    [InlineData(typeof(UpdateClientLedgerEntryEndpoint))]
    [InlineData(typeof(DeleteClientLedgerEntryEndpoint))]
    [InlineData(typeof(SetClientLedgerEntryResolutionEndpoint))]
    public void WriteEndpoint_IsNotSatisfiedByViewOnly(Type endpointType)
    {
        DeclaredPolicies(endpointType)
            .Should().NotContain(ModulePermissionRequirement.PolicyName(ModuleType.Clients, PermissionLevel.View));
    }

    /// <summary>
    /// Runs the endpoint's own <c>Configure</c> and reads back the authorization policies it
    /// asked for, by replaying its route-handler configuration onto a throwaway route.
    /// </summary>
    private static IReadOnlyCollection<string?> DeclaredPolicies(Type endpointType)
    {
        var endpoint = CreateConfigured(endpointType);

        var configure = typeof(EndpointDefinition)
            .GetProperty("UserConfigAction",
                System.Reflection.BindingFlags.Instance
                | System.Reflection.BindingFlags.Public
                | System.Reflection.BindingFlags.NonPublic)!
            .GetValue(endpoint.Definition) as Action<RouteHandlerBuilder>;

        configure.Should().NotBeNull("the endpoint must declare its authorization in Description(...)");

        var app = WebApplication.CreateSlimBuilder().Build();
        configure!(app.MapGet("/probe", () => Results.Ok()));

        return ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(d => d.Endpoints)
            .SelectMany(e => e.Metadata.OfType<IAuthorizeData>())
            .Select(a => a.Policy)
            .ToList();
    }

    /// <summary>
    /// Builds the endpoint through FastEndpoints' own factory, which is what runs
    /// <c>Configure</c> and populates the definition.
    /// </summary>
    /// <remarks>
    /// Reflected rather than typed because the five endpoints have five different request types
    /// and only their shared configuration is under test. Dependencies are passed as nulls:
    /// <c>Configure</c> touches none of them.
    /// </remarks>
    private static BaseEndpoint CreateConfigured(Type endpointType)
    {
        var create = typeof(Factory)
            .GetMethods()
            .Single(m => m.Name == nameof(Factory.Create)
                         && m.GetGenericArguments().Length == 1
                         && m.GetParameters().Length == 1);

        object?[] dependencies =
            [.. endpointType.GetConstructors()[0].GetParameters().Select(object? (_) => null)];

        return (BaseEndpoint)create
            .MakeGenericMethod(endpointType)
            .Invoke(null, [dependencies])!;
    }
}
