using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.ProductDeliveries.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.ProductDeliveries;

public sealed class DeliveryItemSnapshotTests
{
    [Fact]
    public void Apply_CopiesTheWeightInputs()
    {
        var product = ProductBuilder.BuildEntity(kind: ProductKind.Bottle, packageSize: 0.5);
        product.UnitsPerPackage = 20;
        var item = new DeliveryItem { Product = product, Quantity = 4 };

        DeliveryItemSnapshot.Apply(item, product);

        item.Kind.Should().Be(ProductKind.Bottle);
        item.PackageSize.Should().Be(0.5);
        item.UnitsPerPackage.Should().Be(20);
    }

    /// <summary>
    /// Correcting a package size must not move the weight of a delivery already booked in — the
    /// bug this whole snapshot family exists to stop.
    /// </summary>
    [Fact]
    public void Apply_IsIndependentOfLaterProductEdits()
    {
        var product = ProductBuilder.BuildEntity(kind: ProductKind.Bottle, packageSize: 0.5);
        product.UnitsPerPackage = 20;
        var item = new DeliveryItem { Product = product, Quantity = 4 };

        DeliveryItemSnapshot.Apply(item, product);
        product.PackageSize = 10;
        product.UnitsPerPackage = 1;
        product.Kind = ProductKind.Keg;

        item.Kind.Should().Be(ProductKind.Bottle);
        item.PackageSize.Should().Be(0.5);
        item.UnitsPerPackage.Should().Be(20);
    }
}
