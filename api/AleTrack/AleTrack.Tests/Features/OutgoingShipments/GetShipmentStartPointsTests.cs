using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.StartPoints;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FastEndpoints;
using FluentAssertions;
using Microsoft.Extensions.Options;
using static AleTrack.Tests.Features.OutgoingShipments.OutgoingShipmentTestHelpers;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The pickable origins of a run: the company first, then the breweries in the
/// order the catalogue lists them.
/// </summary>
public sealed class GetShipmentStartPointsTests
{
    [Fact]
    public async Task HandleAsync_CompanyAndBreweries_ReturnsCompanyFirstThenBreweriesByDisplayOrder()
    {
        var second = BreweryBuilder.BuildEntity(name: "Svijany", displayOrder: 2,
            officialAddress: AddressBuilder.BuildEntity(city: "Svijany", latitude: 50.5m, longitude: 15.0m));
        var first = BreweryBuilder.BuildEntity(name: "Rohozec", displayOrder: 1,
            officialAddress: AddressBuilder.BuildEntity(city: "Rohozec", latitude: 50.6m, longitude: 15.1m));

        var endpoint = CreateEndpoint([second, first]);

        await endpoint.HandleAsync(default);

        var result = endpoint.Response;
        result.Should().HaveCount(3);
        result[0].Kind.Should().Be(ShipmentStartPointKind.Company);
        result[0].BreweryId.Should().BeNull();
        result[0].AddressKind.Should().BeNull();
        result[0].Name.Should().Be("AleTrack s.r.o.");
        result[0].Address.Should().Be("Turistická 211, 46334 Hrádek nad Nisou");
        result[1].Kind.Should().Be(ShipmentStartPointKind.Brewery);
        result[1].Name.Should().Be("Rohozec");
        // Neither of these has a contact address, so each contributes exactly the
        // one Official entry — no Contact duplicate sneaks in.
        result[1].AddressKind.Should().Be(DeliveryAddressKind.Official);
        result[2].Name.Should().Be("Svijany");
        result[2].AddressKind.Should().Be(DeliveryAddressKind.Official);
    }

    /// <summary>
    /// A brewery is not always loaded at its official address: when it also has a
    /// contact address on file, both are pickable start points. The two addresses use
    /// deliberately distinct cities and coordinates so a bug that resolved both entries
    /// from the same (official) address would fail this assertion.
    /// </summary>
    [Fact]
    public async Task HandleAsync_BreweryWithContactAddress_ReturnsBothAddressesWithDistinctKinds()
    {
        var official = AddressBuilder.BuildEntity(city: "Rohozec", latitude: 50.6m, longitude: 15.1m);
        var contact = AddressBuilder.BuildEntity(city: "Turnov", latitude: 50.59m, longitude: 15.16m);
        var brewery = BreweryBuilder.BuildEntity(
            name: "Rohozec", displayOrder: 1, officialAddress: official, contactAddress: contact);

        var endpoint = CreateEndpoint([brewery]);

        await endpoint.HandleAsync(default);

        var result = endpoint.Response;
        result.Should().HaveCount(3);

        var officialEntry = result.Single(r => r.AddressKind == DeliveryAddressKind.Official);
        officialEntry.BreweryId.Should().Be(brewery.PublicId);
        officialEntry.Address.Should().Contain("Rohozec");
        officialEntry.Latitude.Should().Be(50.6m);

        var contactEntry = result.Single(r => r.AddressKind == DeliveryAddressKind.Contact);
        contactEntry.BreweryId.Should().Be(brewery.PublicId);
        contactEntry.Address.Should().Contain("Turnov");
        contactEntry.Latitude.Should().Be(50.59m);
    }

    /// <summary>
    /// A brewery whose address was never geocoded is still a legal choice — the map
    /// simply cannot plot it. Dropping it would hide a real option.
    /// </summary>
    [Fact]
    public async Task HandleAsync_BreweryWithoutCoordinates_IsStillListed()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Bez souřadnic", displayOrder: 1,
            officialAddress: AddressBuilder.BuildEntity(city: "Nikde", latitude: null, longitude: null));

        var endpoint = CreateEndpoint([brewery]);

        await endpoint.HandleAsync(default);

        endpoint.Response.Should().HaveCount(2);
        endpoint.Response[1].Name.Should().Be("Bez souřadnic");
        endpoint.Response[1].Latitude.Should().BeNull();
        endpoint.Response[1].Longitude.Should().BeNull();
    }

    private static GetShipmentStartPointsEndpoint CreateEndpoint(List<Brewery> breweries)
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: breweries);

        // EndpointWithoutRequest<TResponse> derives from Endpoint<EmptyRequest, TResponse>,
        // not from the non-generic EndpointWithoutRequest, so the with-response builder is
        // the one whose constraint it satisfies.
        return EndpointWithResponseBuilder<EmptyRequest, List<ShipmentStartPointDto>, GetShipmentStartPointsEndpoint>
            .Create(dbContext.Object, Options.Create(Company));
    }
}
