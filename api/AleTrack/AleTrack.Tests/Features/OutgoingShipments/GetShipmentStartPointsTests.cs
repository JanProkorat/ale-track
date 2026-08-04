using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.StartPoints;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FastEndpoints;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The pickable origins of a run: the company first, then the breweries in the
/// order the catalogue lists them.
/// </summary>
public sealed class GetShipmentStartPointsTests
{
    private static readonly CompanyOptions Company = new()
    {
        Name = "AleTrack s.r.o.",
        StreetName = "Nádražní",
        StreetNumber = "12",
        City = "Liberec",
        Zip = "46001",
        Country = Country.Czechia,
        Latitude = 50.7663m,
        Longitude = 15.0543m
    };

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
        result[0].Name.Should().Be("AleTrack s.r.o.");
        result[0].Address.Should().Be("Nádražní 12, 46001 Liberec");
        result[1].Kind.Should().Be(ShipmentStartPointKind.Brewery);
        result[1].Name.Should().Be("Rohozec");
        result[2].Name.Should().Be("Svijany");
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
