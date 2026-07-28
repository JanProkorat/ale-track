using AleTrack.Common.Enums;
using AleTrack.Features.Products.Utils;
using AleTrack.Seeding.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// The unit count is derived, never entered, so this resolver is the only thing standing between a
/// newly created crate and a weight twenty times too small.
/// </summary>
public sealed class ProductUnitsResolverTests
{
    [Theory]
    // Bottles are crates ("Basa"), and the crate size follows from the bottle size.
    [InlineData(ProductKind.Bottle, BottleSize.ZeroPointFiveLiters, "Svijanský Máz", 20)]
    [InlineData(ProductKind.Bottle, BottleSize.ZeroPointThreeThreeLiters, "Prim. Premium", 24)]
    // Litre and two-litre bottles are decorative and sold singly.
    [InlineData(ProductKind.Bottle, BottleSize.OneLiter, "Svijanský Kvasničák", 1)]
    [InlineData(ProductKind.Bottle, BottleSize.TwoLiters, "Svijanský Kvasničák", 1)]
    // A keg is one vessel whatever its size.
    [InlineData(ProductKind.Keg, KegSize.FiftyLiters, "Svijanský Rytíř", 1)]
    [InlineData(ProductKind.Keg, KegSize.FiveLiters, "Šlik", 1)]
    // A plain can is one can.
    [InlineData(ProductKind.Can, CanSize.ZeroPointFiveLiters, "Svijanský Vozka", 1)]
    [InlineData(ProductKind.Can, CanSize.TwoLiters, "Dux", 1)]
    [InlineData(ProductKind.Other, null, "Ucho soudku", 1)]
    public void Resolve_HandlesTheClosedRules(
        ProductKind kind, double? size, string name, int expected)
    {
        ProductUnitsResolver.Resolve(kind, size, name).Should().Be(expected);
    }

    [Theory]
    // The count exists only in the name, which is the whole reason this parse exists.
    [InlineData("Svijanský Máz - 8x", 8)]
    [InlineData("Prim. Premium 8x", 8)]
    [InlineData("Prim. Osm zlatých 8x", 8)]
    [InlineData("Svijany - 7 svijanských kousků", 7)]
    [InlineData("Svijany 6 piv + sklenička", 6)]
    public void Resolve_ReadsThePackCountFromTheName(string name, int expected)
    {
        ProductUnitsResolver.Resolve(ProductKind.Multipack, BottleSize.ZeroPointFiveLiters, name)
            .Should().Be(expected);
    }

    [Fact]
    public void Resolve_IsNotFooledByANumberInTheProductName()
    {
        // "Svijany 450 - 8x" holds two numbers and only one of them is a pack count. The bound on
        // plausible pack sizes is what makes this safe.
        ProductUnitsResolver.Resolve(ProductKind.Multipack, BottleSize.ZeroPointFiveLiters, "Svijany 450 - 8x")
            .Should().Be(8);

        // A bare number with nothing to mark it as a count must not be read as one.
        ProductUnitsResolver.Resolve(ProductKind.Multipack, BottleSize.ZeroPointFiveLiters, "Svijany 450")
            .Should().Be(1);
    }

    [Fact]
    public void Resolve_FindsASixPackFiledAsACan()
    {
        // "6-Pack mix svijanských piv" is ProductKind.Can, not Multipack, and would otherwise be
        // treated as a single can.
        ProductUnitsResolver.Resolve(ProductKind.Can, CanSize.ZeroPointFiveLiters, "6-Pack mix svijanských piv")
            .Should().Be(6);
    }

    [Fact]
    public void Resolve_TreatsLitreMultipacksAsDuoPacks()
    {
        // The duo packs' count was never written down at all — not in the name, not in a column.
        ProductUnitsResolver.Resolve(ProductKind.Multipack, BottleSize.OneLiter, "Řízni si kněžnu")
            .Should().Be(2);
        ProductUnitsResolver.Resolve(ProductKind.Multipack, BottleSize.OneLiter, "Svijany 450")
            .Should().Be(2);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Resolve_FallsBackToOneOnAnUnusableName(string? name)
    {
        // Wrong in the safe direction: understating a pack beats inventing a count.
        ProductUnitsResolver.Resolve(ProductKind.Multipack, 0.5, name).Should().Be(1);
    }

    [Theory]
    [InlineData("Balení 1x")]      // below a plausible pack
    [InlineData("Paleta 480x")]    // above a plausible pack
    public void Resolve_RejectsAnImplausiblePackCount(string name)
    {
        ProductUnitsResolver.Resolve(ProductKind.Multipack, 0.5, name).Should().Be(1);
    }

    /// <summary>
    /// The seed builders carry explicit unit counts, verified row by row against the dev database.
    /// If the resolver disagrees with any of them, one of the two is wrong — and this is the only
    /// place that would notice, since products created through the API never carry an explicit
    /// value for comparison.
    /// </summary>
    [Fact]
    public void Resolve_AgreesWithEverySeededProduct()
    {
        var seeded = SvijanyProductsBuilder.GetSampleBottledProducts()
            .Concat(SvijanyProductsBuilder.GetSampleKegProducts())
            .Concat(SvijanyProductsBuilder.GetSampleLimoKegProducts())
            .Concat(SvijanyProductsBuilder.GetSampleMultipackProducts())
            .Concat(SvijanyProductsBuilder.GetSampleCanZeroPointFiveProducts())
            .Concat(SvijanyProductsBuilder.GetSampleCanZeroPointThreeProducts())
            .Concat(SvijanyProductsBuilder.GetSampleTwoLiterCanProducts())
            .Concat(SvijanyProductsBuilder.GetSampleFiveLiterKegProducts())
            .Concat(SvijanyProductsBuilder.GetSampleDecorativeBottleProducts())
            .Concat(SvijanyProductsBuilder.GetSampleDuoPackProducts())
            .Concat(SvijanyProductsBuilder.GetSampleOtherProducts())
            .Concat(RohozecProductsBuilder.GetRohozecKegProducts())
            .Concat(RohozecProductsBuilder.GetRohozecBottleProducts())
            .Concat(RohozecProductsBuilder.GetRohozecCanProducts())
            .Concat(PrimatorProductsBuilder.GetPrimatorKegProducts())
            .Concat(PrimatorProductsBuilder.GetPrimatorBottleProducts())
            .Concat(PrimatorProductsBuilder.GetPrimatorMultipackProducts())
            .Concat(PrimatorProductsBuilder.GetPrimatorCanProducts())
            .ToList();

        seeded.Should().HaveCount(232, "the resolver should be checked against the whole catalogue");

        var disagreements = seeded
            .Select(p => new
            {
                p.Name,
                p.Kind,
                p.PackageSize,
                Seeded = p.UnitsPerPackage,
                Resolved = ProductUnitsResolver.Resolve(p.Kind, p.PackageSize, p.Name),
            })
            .Where(x => x.Seeded != x.Resolved)
            .ToList();

        disagreements.Should().BeEmpty();
    }
}
