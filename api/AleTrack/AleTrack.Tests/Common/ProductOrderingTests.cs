using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Common;

/// <summary>
/// The app-wide product order, asked for by the customer: by degree, soft drinks last.
/// Both halves of <see cref="ProductOrdering"/> are held to the same expectations —
/// the queryable one that the endpoints use and the in-memory one the invoice mapper does.
/// </summary>
public sealed class ProductOrderingTests
{
    private static Product Product(string name, ProductType type, float? plato, double? size = 0.5)
    {
        var product = ProductBuilder.BuildEntity(name: name, type: type, platoDegree: plato, packageSize: size);
        product.PlatoDegree = plato;   // the builder defaults a degree; null has to be forced
        return product;
    }

    private static List<string> Ordered(params Product[] products) =>
        products.AsQueryable().OrderForDisplayWithinBrewery().Select(p => p.Name).ToList();

    [Fact]
    public void OrderForDisplay_SortsByDegreeAscending()
    {
        var order = Ordered(
            Product("Dvanáctka", ProductType.PaleLager, 12),
            Product("Desítka", ProductType.PaleDraftBeer, 10),
            Product("Jedenáctka", ProductType.PaleLager, 11));

        order.Should().Equal("Desítka", "Jedenáctka", "Dvanáctka");
    }

    [Fact]
    public void OrderForDisplay_PutsNonBeerLast()
    {
        var order = Ordered(
            Product("Limonáda", ProductType.Lemonade, null),
            Product("Merch", ProductType.Merchandise, null),
            Product("Ostatní", ProductType.Other, null),
            Product("Desítka", ProductType.PaleDraftBeer, 10));

        order.Should().StartWith(["Desítka"]);
        order.Should().Equal("Desítka", "Limonáda", "Merch", "Ostatní");
    }

    [Fact]
    public void OrderForDisplay_KeepsDegreelessBeerAheadOfSoftDrinks()
    {
        // Nealko and radler are beer with no degree: after the degreed beers,
        // but still in front of the limonáda.
        var order = Ordered(
            Product("Limonáda", ProductType.Lemonade, null),
            Product("Nealko", ProductType.NonAlcoholicBeer, null),
            Product("Radler", ProductType.Radler, null),
            Product("Dvanáctka", ProductType.PaleLager, 12));

        order.Should().Equal("Dvanáctka", "Nealko", "Radler", "Limonáda");
    }

    [Fact]
    public void OrderForDisplay_BreaksDegreeTiesBySize()
    {
        var order = Ordered(
            Product("Sud 50", ProductType.PaleLager, 11, 50),
            Product("Plechovka", ProductType.PaleLager, 11, 0.5),
            Product("Sud 15", ProductType.PaleLager, 11, 15));

        order.Should().Equal("Plechovka", "Sud 15", "Sud 50");
    }

    [Fact]
    public void OrderForDisplay_OrdersByBreweryFirst()
    {
        var first = BreweryBuilder.BuildEntity(name: "Svijany", displayOrder: 1);
        var second = BreweryBuilder.BuildEntity(name: "Primátor", displayOrder: 2);

        var lateBrewerysBeer = Product("Primátor desítka", ProductType.PaleDraftBeer, 10);
        lateBrewerysBeer.Brewery = second;
        var earlyBrewerysLemonade = Product("Svijany limo", ProductType.Lemonade, null);
        earlyBrewerysLemonade.Brewery = first;

        var order = new[] { lateBrewerysBeer, earlyBrewerysLemonade }
            .AsQueryable().OrderForDisplay().Select(p => p.Name).ToList();

        // The brewery grouping wins: a limonáda of the first brewery still precedes
        // the second brewery's beer, because they are never shown in one list.
        order.Should().Equal("Svijany limo", "Primátor desítka");
    }

    [Fact]
    public void Compare_MatchesTheQueryableOrder()
    {
        var products = new[]
        {
            Product("Limonáda", ProductType.Lemonade, null),
            Product("Nealko", ProductType.NonAlcoholicBeer, null),
            Product("Dvanáctka", ProductType.PaleLager, 12),
            Product("Desítka", ProductType.PaleDraftBeer, 10, 30),
            Product("Desítka velký sud", ProductType.PaleDraftBeer, 10, 50),
        };

        var viaQuery = products.AsQueryable().OrderForDisplayWithinBrewery().Select(p => p.Name).ToList();
        var viaComparer = products
            .Order(Comparer<Product>.Create((a, b) => ProductOrdering.Compare(
                (a.Type, a.PlatoDegree, a.PackageSize, a.Name),
                (b.Type, b.PlatoDegree, b.PackageSize, b.Name))))
            .Select(p => p.Name)
            .ToList();

        viaComparer.Should().Equal(viaQuery);
    }

    [Theory]
    [InlineData(ProductType.Lemonade, true)]
    [InlineData(ProductType.Merchandise, true)]
    [InlineData(ProductType.Other, true)]
    [InlineData(ProductType.NonAlcoholicBeer, false)]
    [InlineData(ProductType.Radler, false)]
    [InlineData(ProductType.PaleLager, false)]
    public void IsNonBeer_ClassifiesTheTypes(ProductType type, bool expected)
        => ProductOrdering.IsNonBeer(type).Should().Be(expected);
}
