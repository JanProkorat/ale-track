namespace AleTrack.Features.Products.Utils;

/// <summary>
/// Gross weight in kilograms of one filled container — the bottle, can or keg itself, contents and
/// vessel together. A package holding several containers is
/// <c>UnitsPerPackage × container + outer tare</c>; see <see cref="ProductWeightCalculator"/>.
/// </summary>
public static class PackageWeight
{
    // --- Bottles: glass plus contents. A 0.5 l returnable weighs ~380 g empty. ---

    /// <summary>0.33 l bottle: ~0.29 kg glass + 0.33 kg contents.</summary>
    public const double BottleZeroPointThreeThree = 0.62;

    /// <summary>0.5 l bottle: 0.38 kg glass + ~0.5 kg contents.</summary>
    public const double BottleZeroPointFive = 0.885;

    /// <summary>1 l bottle: ~0.6 kg glass + 1 kg contents.</summary>
    public const double BottleOneLiter = 1.6;

    /// <summary>2 l bottle: ~0.8 kg glass + 2 kg contents.</summary>
    public const double BottleTwoLiters = 2.8;

    // --- Cans: the aluminium is a rounding error against the contents. ---

    public const double CanZeroPointThreeThree = 0.33;
    public const double CanZeroPointFive = 0.5;
    public const double CanTwoLiters = 2.0;

    // --- Kegs: contents plus the vessel, which is the bulk of the tare on small sizes. ---

    public const double KegFiveLiters = 5;
    public const double KegFifteenLiters = 20;
    public const double KegTwentyLiters = 20;
    public const double KegThirtyLiters = 42;
    public const double KegFiftyLiters = 62;

    // --- Outer packaging, counted once per package rather than per container. ---

    /// <summary>A standard plastic bottle crate ("basa").</summary>
    public const double CrateTare = 2.0;

    /// <summary>A multipack's carrier, carton or shrink wrap.</summary>
    public const double MultipackTare = 0.15;
}
