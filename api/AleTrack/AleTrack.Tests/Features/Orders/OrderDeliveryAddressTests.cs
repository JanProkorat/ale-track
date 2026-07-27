using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.Orders;

public sealed class OrderDeliveryAddressTests
{
    // A new order delivers to the billing address unless told otherwise —
    // the enum's zero value must therefore be Official, because that is also
    // what the column default and the migration backfill rely on.
    [Fact]
    public void NewOrder_DefaultsToOfficialAddressAndNoPlace()
    {
        var order = OrderBuilder.BuildEntity();

        order.DeliveryAddressKind.Should().Be(DeliveryAddressKind.Official);
        order.ClientDeliveryPlaceId.Should().BeNull();
    }

    [Fact]
    public void NewShipmentStop_IsNotOverriddenAndHasNoPendingChange()
    {
        var stop = new OutgoingShipmentStop { Kind = OutgoingShipmentStopKind.Order, Order = 1 };

        stop.IsAddressOverridden.Should().BeFalse();
        stop.AddressChangedAt.Should().BeNull();
    }
}
