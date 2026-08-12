using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The detail response resolves the vehicle and drivers server-side, the same way it already
/// resolves the start point — so a driver-scoped caller (who has no Vehicles/Řidiči module
/// permission) can still see who and what they are running with, without a second request.
/// </summary>
public sealed class GetOutgoingShipmentDetailVehicleAndDriversTests
{
    private static readonly CompanyOptions Company = new();

    [Fact]
    public async Task HandleAsync_VehicleAssigned_ReturnsResolvedVehicleNameAndMaxWeight()
    {
        var vehicle = VehicleBuilder.BuildEntity(name: "Iveco Daily", maxWeight: 3500.0);
        var shipment = OutgoingShipmentBuilder.BuildEntity(vehicle: vehicle);

        var response = await DetailOf(shipment, vehicles: [vehicle]);

        response.Vehicle.Should().NotBeNull();
        response.Vehicle!.Id.Should().Be(vehicle.PublicId);
        response.Vehicle.Name.Should().Be("Iveco Daily");
        response.Vehicle.MaxWeight.Should().Be(3500.0);
    }

    [Fact]
    public async Task HandleAsync_NoVehicleAssigned_ReturnsNullVehicle()
    {
        var shipment = OutgoingShipmentBuilder.BuildEntity(vehicle: null);

        var response = await DetailOf(shipment);

        response.Vehicle.Should().BeNull();
    }

    /// <summary>
    /// Seeds two drivers so a fixture with only one cannot coincidentally pass — the co-driver
    /// disappearing from a driver-scoped account's own driver list is exactly the bug this covers.
    /// </summary>
    [Fact]
    public async Task HandleAsync_TwoDriversAssigned_ReturnsBothWithNamesPhoneAndColour()
    {
        var novak = DriverBuilder.BuildEntity(firstName: "Jan", lastName: "Novák", phoneNumber: "+420111222333", color: "#111111");
        var adamec = DriverBuilder.BuildEntity(firstName: "Petr", lastName: "Adamec", phoneNumber: "+420444555666", color: "#222222");
        var shipment = OutgoingShipmentBuilder.BuildEntity(drivers:
        [
            new OutgoingShipmentDriver { Driver = novak },
            new OutgoingShipmentDriver { Driver = adamec }
        ]);

        var response = await DetailOf(shipment, drivers: [novak, adamec]);

        response.Drivers.Should().HaveCount(2);

        // Ordered by last name then first name (matches ShipmentExportQuery), so Adamec is first.
        response.Drivers[0].Id.Should().Be(adamec.PublicId);
        response.Drivers[0].FirstName.Should().Be("Petr");
        response.Drivers[0].LastName.Should().Be("Adamec");
        response.Drivers[0].PhoneNumber.Should().Be("+420444555666");
        response.Drivers[0].Color.Should().Be("#222222");

        // The co-driver specifically — the one that silently vanished from the client's
        // driver-scoped list.
        response.Drivers[1].Id.Should().Be(novak.PublicId);
        response.Drivers[1].FirstName.Should().Be("Jan");
        response.Drivers[1].LastName.Should().Be("Novák");
        response.Drivers[1].PhoneNumber.Should().Be("+420111222333");
        response.Drivers[1].Color.Should().Be("#111111");
    }

    private static async Task<OutgoingShipmentDetailDto> DetailOf(
        OutgoingShipment shipment,
        List<Vehicle>? vehicles = null,
        List<Driver>? drivers = null)
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [shipment],
            vehicles: vehicles ?? [],
            drivers: drivers ?? []);

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object, Options.Create(Company), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new GetOutgoingShipmentDetailRequest { Id = shipment.PublicId }, CancellationToken.None);

        return endpoint.Response;
    }
}
