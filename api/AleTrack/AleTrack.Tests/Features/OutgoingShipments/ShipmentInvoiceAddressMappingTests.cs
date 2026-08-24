using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Invoices;
using AleTrack.Features.OutgoingShipments.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// What an invoice's DTO carries off its client: the official address the frontend falls back to
/// when the payer has no stop of its own, and the trading name that tells two clients of the same
/// name apart.
/// </summary>
public sealed class ShipmentInvoiceAddressMappingTests
{
    private const long ClientAId = 1;

    [Fact]
    public void ToDto_ClientWithOfficialAddress_MapsItOntoTheInvoice()
    {
        var client = new Client
        {
            Id = ClientAId, PublicId = Guid.NewGuid(), Name = "Klient A",
            OfficialAddress = new Address
            {
                StreetName = "Hlavní", StreetNumber = "12", City = "Brno", Zip = "60200", Country = Country.Czechia
            }
        };

        var dto = Map(ShipmentWith(client)).Invoices.Single();

        dto.ClientOfficialAddress.Should().NotBeNull();
        dto.ClientOfficialAddress!.StreetName.Should().Be("Hlavní");
        dto.ClientOfficialAddress!.StreetNumber.Should().Be("12");
        dto.ClientOfficialAddress!.City.Should().Be("Brno");
        dto.ClientOfficialAddress!.Zip.Should().Be("60200");
        dto.ClientOfficialAddress!.Country.Should().Be(Country.Czechia);
    }

    [Fact]
    public void ToDto_ClientWithNoOfficialAddress_LeavesItNull()
    {
        var client = new Client { Id = ClientAId, PublicId = Guid.NewGuid(), Name = "Klient A", OfficialAddress = null };

        var dto = Map(ShipmentWith(client)).Invoices.Single();

        dto.ClientOfficialAddress.Should().BeNull();
    }

    /// <summary>
    /// Two clients can genuinely share a name — the trading name is what the office reads to tell
    /// them apart, on the Fakturace band and in the export drawer.
    /// </summary>
    [Fact]
    public void ToDto_ClientWithBusinessName_MapsItOntoTheInvoice()
    {
        var client = new Client
        {
            Id = ClientAId, PublicId = Guid.NewGuid(), Name = "Luděk Pachl", BusinessName = "Pachl s.r.o."
        };

        var dto = Map(ShipmentWith(client)).Invoices.Single();

        dto.ClientName.Should().Be("Luděk Pachl");
        dto.ClientBusinessName.Should().Be("Pachl s.r.o.");
    }

    [Fact]
    public void ToDto_ClientWithNoBusinessName_LeavesItNull()
    {
        var client = new Client { Id = ClientAId, PublicId = Guid.NewGuid(), Name = "Klient A" };

        Map(ShipmentWith(client)).Invoices.Single().ClientBusinessName.Should().BeNull();
    }

    private static ShipmentInvoicesDto Map(OutgoingShipment shipment)
    {
        var split = ShipmentInvoiceSplit.Of(shipment);
        return ShipmentInvoiceMapper.ToDto(split, ShipmentInvoiceReconciler.Reconcile(split));
    }

    /// <summary>A one-stop run for a single client carrying a single billable item.</summary>
    private static OutgoingShipment ShipmentWith(Client client)
    {
        var product = new Product
        {
            Id = 900, PublicId = Guid.NewGuid(), Name = "Ležák 11°",
            Kind = ProductKind.Keg, Type = ProductType.PaleLager, PlatoDegree = 11, PackageSize = 30, PriceWithVat = 100m
        };

        var item = new OrderItem { Id = 1, PublicId = Guid.NewGuid(), Quantity = 2, ProductId = product.Id, Product = product };

        var shipment = new OutgoingShipment
        {
            PublicId = Guid.NewGuid(), Name = "Rozvoz", State = OutgoingShipmentState.Created
        };

        var order = new Order
        {
            Id = 101, PublicId = Guid.NewGuid(), ClientId = client.Id, Client = client, OrderItems = [item]
        };
        item.OrderId = order.Id;

        shipment.Stops.Add(new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(), Kind = OutgoingShipmentStopKind.Order, Order = 1,
            ClientOrder = order, OutgoingShipment = shipment
        });

        return shipment;
    }
}
