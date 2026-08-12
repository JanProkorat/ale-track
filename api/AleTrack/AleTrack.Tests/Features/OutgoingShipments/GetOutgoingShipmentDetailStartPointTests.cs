using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The detail response resolves the start point so the map needs no second request.
/// </summary>
public sealed class GetOutgoingShipmentDetailStartPointTests
{
    private static readonly CompanyOptions Company = new()
    {
        Name = "AleTrack s.r.o.",
        StreetName = "Turistická",
        StreetNumber = "211",
        City = "Hrádek nad Nisou",
        Zip = "46334",
        Country = Country.Czechia,
        Latitude = 50.841437m,
        Longitude = 14.837309m
    };

    [Fact]
    public async Task HandleAsync_StartPointIsCompany_ReturnsCompanyAddress()
    {
        var shipment = OutgoingShipmentBuilder.BuildEntity();
        shipment.StartPointKind = ShipmentStartPointKind.Company;
        shipment.StartBreweryId = null;

        var response = await DetailOf(shipment);

        response.StartPointKind.Should().Be(ShipmentStartPointKind.Company);
        response.StartBreweryId.Should().BeNull();
        response.StartPointName.Should().Be("AleTrack s.r.o.");
        response.StartPointLatitude.Should().Be(50.841437m);
    }

    [Fact]
    public async Task HandleAsync_StartPointIsBrewery_ReturnsBreweryNameAndCoordinates()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Svijany",
            officialAddress: AddressBuilder.BuildEntity(city: "Svijany", latitude: 50.5m, longitude: 15.0m));
        var shipment = OutgoingShipmentBuilder.BuildEntity();
        shipment.StartPointKind = ShipmentStartPointKind.Brewery;
        shipment.StartBrewery = brewery;
        shipment.StartBreweryId = brewery.Id;
        shipment.StartBreweryAddressKind = DeliveryAddressKind.Official;

        var response = await DetailOf(shipment, [brewery]);

        response.StartPointKind.Should().Be(ShipmentStartPointKind.Brewery);
        response.StartBreweryId.Should().Be(brewery.PublicId);
        response.StartBreweryAddressKind.Should().Be(DeliveryAddressKind.Official);
        response.StartPointName.Should().Be("Svijany");
        response.StartPointLatitude.Should().Be(50.5m);
        response.StartPointAddress.Should().Contain("Svijany");
    }

    /// <summary>
    /// The regression this correction exists to prevent: a shipment that chose the
    /// brewery's contact address must resolve from it, not silently fall back to the
    /// official one. Official and contact use deliberately distinct cities and
    /// coordinates, so a bug that always resolved from <c>OfficialAddress</c> would
    /// make this assertion fail rather than pass by coincidence.
    /// </summary>
    [Fact]
    public async Task HandleAsync_StartPointIsBreweryContactAddress_ResolvesContactNotOfficial()
    {
        var brewery = BreweryBuilder.BuildEntity(
            name: "Svijany",
            officialAddress: AddressBuilder.BuildEntity(city: "Svijany", latitude: 50.5m, longitude: 15.0m),
            contactAddress: AddressBuilder.BuildEntity(city: "Turnov", latitude: 50.59m, longitude: 15.16m));
        var shipment = OutgoingShipmentBuilder.BuildEntity();
        shipment.StartPointKind = ShipmentStartPointKind.Brewery;
        shipment.StartBrewery = brewery;
        shipment.StartBreweryId = brewery.Id;
        shipment.StartBreweryAddressKind = DeliveryAddressKind.Contact;

        var response = await DetailOf(shipment, [brewery]);

        response.StartBreweryAddressKind.Should().Be(DeliveryAddressKind.Contact);
        response.StartPointAddress.Should().Contain("Turnov");
        response.StartPointAddress.Should().NotContain("Svijany");
        response.StartPointLatitude.Should().Be(50.59m);
        response.StartPointLongitude.Should().Be(15.16m);
    }

    /// <summary>
    /// Every run that predates this feature reads as starting at the company —
    /// exactly what the hardcoded depot used to mean.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ShipmentPredatingTheFeature_DefaultsToCompany()
    {
        var response = await DetailOf(OutgoingShipmentBuilder.BuildEntity());

        response.StartPointKind.Should().Be(ShipmentStartPointKind.Company);
    }

    private static async Task<OutgoingShipmentDetailDto> DetailOf(OutgoingShipment shipment, List<Brewery>? breweries = null)
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [shipment],
            breweries: breweries ?? []);

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object, Options.Create(Company), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new GetOutgoingShipmentDetailRequest { Id = shipment.PublicId }, CancellationToken.None);

        return endpoint.Response;
    }
}
