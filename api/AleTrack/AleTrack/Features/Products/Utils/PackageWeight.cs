namespace AleTrack.Features.Products.Utils;

/// <summary>
/// Gross weight in kilograms of one sellable package, container included — not the weight of the
/// liquid alone. For <see cref="AleTrack.Common.Enums.ProductKind.Bottle"/> the package is a crate
/// ("basa"), so the figure covers the bottles plus the crate itself.
/// </summary>
public static class PackageWeight
{
    public const double ZeroPointThree = 0.33;
    public const double ZeroPointFive = 0.5;
    public const double OneKilo = 1;
    public const double TwoKilos = 2;

    /// <summary>
    /// A 5 l party keg: ~5 kg beer plus its container. Was 2, which contradicted the name and
    /// under-reported every 5 l keg.
    /// </summary>
    public const double FiveKilos = 5;

    /// <summary>A 24 × 0.33 l crate: 24 × (~0.29 kg glass + 0.33 kg beer) + ~1.9 kg crate.</summary>
    public const double SeventeenKilos = 17;

    /// <summary>A 20 × 0.5 l crate: 20 × (0.38 kg glass + ~0.5 kg beer) + ~2 kg crate.</summary>
    public const double TwentyKilos = 20;

    public const double FortyTwoKilos = 42;
    public const double SixtyTwoKilos = 62;
}
