using AleTrack.Common.Utils;
using AleTrack.Entities;
using FluentAssertions;

namespace AleTrack.Tests.Common;

public sealed class ClientPriceResolverTests
{
    private static Product Product(decimal withVat = 1290m, decimal? withoutVat = 1066m,
        decimal? unitWithVat = 43m, decimal? unitWithoutVat = 35.53m) => new()
    {
        Id = 1,
        Name = "Albrecht 12°",
        PriceWithVat = withVat,
        PriceWithoutVat = withoutVat,
        PriceForUnitWithVat = unitWithVat,
        PriceForUnitWithoutVat = unitWithoutVat
    };

    [Fact]
    public void Resolve_NoOverride_ReturnsCatalogPricesAndNullListPrice()
    {
        var resolved = ClientPriceList.Empty.Resolve(Product());

        resolved.PriceWithVat.Should().Be(1290m);
        resolved.PriceWithoutVat.Should().Be(1066m);
        resolved.ListPriceWithVat.Should().BeNull();
    }

    [Fact]
    public void Resolve_Override_ScalesDerivedFieldsByTheProductsOwnRatio()
    {
        var list = new ClientPriceList(new Dictionary<long, decimal> { [1] = 1190m });

        var resolved = list.Resolve(Product());

        resolved.PriceWithVat.Should().Be(1190m);
        // 1190/1290 = 0.92248…; 1066 * that = 983.36
        resolved.PriceWithoutVat.Should().Be(983.36m);
        resolved.PriceForUnitWithVat.Should().Be(39.67m);
        resolved.ListPriceWithVat.Should().Be(1290m);
    }

    [Fact]
    public void Resolve_Override_NullDerivedFieldsStayNull()
    {
        var list = new ClientPriceList(new Dictionary<long, decimal> { [1] = 1190m });

        var resolved = list.Resolve(Product(withoutVat: null, unitWithVat: null, unitWithoutVat: null));

        resolved.PriceWithVat.Should().Be(1190m);
        resolved.PriceWithoutVat.Should().BeNull();
        resolved.PriceForUnitWithVat.Should().BeNull();
        resolved.ListPriceWithVat.Should().Be(1290m);
    }

    [Fact]
    public void Resolve_ZeroPricedProduct_TakesOverrideAndKeepsProductsOwnDerivedFields()
    {
        // The ratio is undefined, so the three derived fields keep the product's values
        // rather than collapsing to zero. Matches BulkPriceDrawer's ratio = 1 fallback.
        var list = new ClientPriceList(new Dictionary<long, decimal> { [1] = 500m });

        var resolved = list.Resolve(Product(withVat: 0m, withoutVat: 10m, unitWithVat: 2m, unitWithoutVat: 1m));

        resolved.PriceWithVat.Should().Be(500m);
        resolved.PriceWithoutVat.Should().Be(10m);
        resolved.PriceForUnitWithVat.Should().Be(2m);
        resolved.ListPriceWithVat.Should().Be(0m);
    }

    [Fact]
    public void Resolve_OverrideEqualToCatalog_StillReportsListPrice()
    {
        // A price deliberately set to the ceník value is still an override: the row
        // exists, so the UI must be able to say so.
        var list = new ClientPriceList(new Dictionary<long, decimal> { [1] = 1290m });

        var resolved = list.Resolve(Product());

        resolved.PriceWithVat.Should().Be(1290m);
        resolved.ListPriceWithVat.Should().Be(1290m);
    }
}
