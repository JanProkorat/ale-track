using AleTrack.Entities;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// The shape of the payer relation on the entity itself: a client may carry no official
/// address, and may point at exactly one payer that holds it back.
/// </summary>
public sealed class ClientInvoicingRelationTests
{
    [Fact]
    public void Client_CanBeBuiltWithoutOfficialAddress()
    {
        var client = ClientBuilder.BuildEntity(noOfficialAddress: true);

        client.OfficialAddress.Should().BeNull();
    }

    [Fact]
    public void Client_CarriesItsPayerAndItsSubClients()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 1;

        var sub = ClientBuilder.BuildEntity(
            name: "Pub A",
            noOfficialAddress: true,
            invoicingClientId: payer.Id,
            invoicingClient: payer);

        payer.InvoicedClients.Add(sub);

        sub.InvoicingClientId.Should().Be(1);
        sub.InvoicingClient.Should().BeSameAs(payer);
        payer.InvoicedClients.Should().ContainSingle().Which.Should().BeSameAs(sub);
        payer.InvoicingClientId.Should().BeNull();
    }
}
