using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.Clients.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// The rules the schema cannot express: one flat level, a payer that can actually be
/// invoiced, and no client pointing at itself.
/// </summary>
public sealed class InvoicingClientResolverTests
{
    [Fact]
    public async Task ResolveAsync_NoPayerRequested_ReturnsNull()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var result = await InvoicingClientResolver.ResolveAsync(
            dbContext.Object, clientPublicId: Guid.NewGuid(), invoicingClientPublicId: null,
            CancellationToken.None);

        result.Should().BeNull();
    }

    [Fact]
    public async Task ResolveAsync_ValidPayer_ReturnsItsInternalId()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 7;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer]);

        var result = await InvoicingClientResolver.ResolveAsync(
            dbContext.Object, clientPublicId: Guid.NewGuid(), payer.PublicId, CancellationToken.None);

        result.Should().Be(7);
    }

    [Fact]
    public async Task ResolveAsync_UnknownPayer_Throws404()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var act = () => InvoicingClientResolver.ResolveAsync(
            dbContext.Object, clientPublicId: Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task ResolveAsync_PayerIsTheClientItself_Throws400()
    {
        var client = ClientBuilder.BuildEntity();
        client.Id = 3;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var act = () => InvoicingClientResolver.ResolveAsync(
            dbContext.Object, client.PublicId, client.PublicId, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task ResolveAsync_PayerAlreadyHasAPayer_Throws400()
    {
        // No chains: the relation is exactly one hop, so "who pays" never needs walking.
        var head = ClientBuilder.BuildEntity(name: "Head");
        head.Id = 1;
        var middle = ClientBuilder.BuildEntity(name: "Middle", invoicingClientId: head.Id);
        middle.Id = 2;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [head, middle]);

        var act = () => InvoicingClientResolver.ResolveAsync(
            dbContext.Object, Guid.NewGuid(), middle.PublicId, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task ResolveAsync_PayerWithoutOfficialAddress_Throws400()
    {
        var payer = ClientBuilder.BuildEntity(name: "No address", noOfficialAddress: true);
        payer.Id = 4;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer]);

        var act = () => InvoicingClientResolver.ResolveAsync(
            dbContext.Object, Guid.NewGuid(), payer.PublicId, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task ResolveAsync_ClientThatIsItselfAPayer_Throws400()
    {
        // The other direction of the same rule: a client with sub-clients cannot be given one.
        var payer = ClientBuilder.BuildEntity(name: "Head");
        payer.Id = 1;
        var client = ClientBuilder.BuildEntity(name: "Also a head");
        client.Id = 2;
        var sub = ClientBuilder.BuildEntity(name: "Sub", invoicingClientId: client.Id);
        sub.Id = 3;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, client, sub]);

        var act = () => InvoicingClientResolver.ResolveAsync(
            dbContext.Object, client.PublicId, payer.PublicId, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(400);
    }
}
