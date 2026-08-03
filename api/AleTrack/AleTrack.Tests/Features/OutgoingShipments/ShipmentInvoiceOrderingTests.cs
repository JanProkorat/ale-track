using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Invoices;
using AleTrack.Features.OutgoingShipments.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The order the lines of an invoice are read in: kegs first, then the app-wide product order.
/// </summary>
/// <remarks>
/// This is the one surface where the kegs lead — the nakládka still loads them last — so the
/// rule is pinned here rather than in <c>ProductOrderingTests</c>.
/// </remarks>
public sealed class ShipmentInvoiceOrderingTests
{
    private const long ClientAId = 1;

    [Fact]
    public void ToDto_OrdersInvoiceLines_KegsFirstThenByDegreeAndSize()
    {
        var shipment = ShipmentWith(
            Item(itemId: 11, ProductKind.Bottle, ProductType.PaleLager, platoDegree: 11, packageSize: 0.5, name: "Ležák 11° basa"),
            Item(itemId: 12, ProductKind.Keg, ProductType.PaleLager, platoDegree: 12, packageSize: 50, name: "Speciál 12° sud 50"),
            Item(itemId: 13, ProductKind.Keg, ProductType.PaleLager, platoDegree: 11, packageSize: 30, name: "Ležák 11° sud"),
            Item(itemId: 14, ProductKind.Keg, ProductType.Lemonade, platoDegree: null, packageSize: 30, name: "Limonáda sud"),
            Item(itemId: 15, ProductKind.Can, ProductType.PaleLager, platoDegree: 10, packageSize: 0.5, name: "Výčepní 10° plech"));

        var lines = Map(shipment).Invoices.Single().Lines;

        lines.Select(l => l.Name).Should().Equal(
            "Ležák 11° sud",
            "Speciál 12° sud 50",
            "Limonáda sud",
            "Výčepní 10° plech",
            "Ležák 11° basa");
    }

    [Fact]
    public void ToDto_OrdersPrivateLines_ByTheSameRule()
    {
        var shipment = ShipmentWith(
            Item(itemId: 21, ProductKind.Bottle, ProductType.PaleLager, platoDegree: 11, packageSize: 0.5, name: "Ležák 11° basa"),
            Item(itemId: 22, ProductKind.Keg, ProductType.PaleLager, platoDegree: 12, packageSize: 30, name: "Speciál 12° sud"));

        // Every piece is excluded from invoicing, so the only ordering under test is the one
        // applied to the private list.
        var split = ShipmentInvoiceSplit.Of(shipment);
        var reconcileResult = ShipmentInvoiceReconciler.Reconcile(split);
        foreach (var invoice in shipment.Invoices)
        {
            foreach (var line in invoice.Lines)
            {
                line.IsPrivate = true;
                split.PrivateLines.Add(line);
            }

            invoice.Lines.Clear();
        }

        ShipmentInvoiceMapper.ToDto(split, reconcileResult).PrivateLines
            .Select(l => l.Name).Should().Equal("Speciál 12° sud", "Ležák 11° basa");
    }

    [Fact]
    public void ToDto_CustomExtra_SortsWithTheNonKegs()
    {
        var shipment = ShipmentWith(
            Item(itemId: 31, ProductKind.Keg, ProductType.PaleLager, platoDegree: 12, packageSize: 30, name: "Speciál 12° sud"));

        var order = shipment.Stops.Single().ClientOrder!;
        order.CustomExtraItems.Add(new OrderCustomExtraItem
        {
            Id = 91,
            PublicId = Guid.NewGuid(),
            OrderId = order.Id,
            Description = "Přepravky",
            Quantity = 3
        });

        // A custom extra carries no kind at all; a missing value must not pull it in front of
        // the kegs.
        Map(shipment).Invoices.Single().Lines
            .Select(l => l.Name).Should().Equal("Speciál 12° sud", "Přepravky");
    }

    private static ShipmentInvoicesDto Map(OutgoingShipment shipment)
    {
        var split = ShipmentInvoiceSplit.Of(shipment);
        return ShipmentInvoiceMapper.ToDto(split, ShipmentInvoiceReconciler.Reconcile(split));
    }

    private static OrderItem Item(
        long itemId,
        ProductKind kind,
        ProductType type,
        float? platoDegree,
        double packageSize,
        string name)
    {
        var product = new Product
        {
            Id = itemId + 100,
            PublicId = Guid.NewGuid(),
            Name = name,
            Kind = kind,
            Type = type,
            PlatoDegree = platoDegree,
            PackageSize = packageSize,
            PriceWithVat = 100m
        };

        return new OrderItem
        {
            Id = itemId,
            PublicId = Guid.NewGuid(),
            Quantity = 2,
            ProductId = product.Id,
            Product = product
        };
    }

    /// <summary>
    /// A one-stop run for client A carrying <paramref name="items"/>, which reconciliation turns
    /// into a single invoice holding all of them.
    /// </summary>
    private static OutgoingShipment ShipmentWith(params OrderItem[] items)
    {
        var shipment = new OutgoingShipment
        {
            PublicId = Guid.NewGuid(),
            Name = "Rozvoz",
            State = OutgoingShipmentState.Created
        };

        var order = new Order
        {
            Id = 101,
            PublicId = Guid.NewGuid(),
            ClientId = ClientAId,
            Client = new Client { Id = ClientAId, PublicId = Guid.NewGuid(), Name = "Klient A" }
        };

        foreach (var item in items)
        {
            item.OrderId = order.Id;
            order.OrderItems.Add(item);
        }

        var stop = new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            ClientOrder = order,
            OutgoingShipment = shipment
        };
        shipment.Stops.Add(stop);

        return shipment;
    }
}
