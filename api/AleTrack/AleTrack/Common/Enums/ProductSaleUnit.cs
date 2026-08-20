namespace AleTrack.Common.Enums;

/// <summary>
/// How many containers one sellable, orderable, loadable unit holds — the thing a price on a
/// brewery's price list refers to. Paired with <see cref="ProductContainer"/>; the count itself is
/// <see cref="Entities.Product.UnitsPerPackage"/>.
/// </summary>
/// <remarks>
/// There is no Duopack value: a duopack is <see cref="Multipack"/> with two units. There is no
/// TopClip value either — the price lists quote cans per piece and per tray only, so the six-can
/// sub-bundle inside a tray is not something anyone sells.
/// </remarks>
public enum ProductSaleUnit
{
    /// <summary>
    /// One container on its own: a keg, a 2 l can, a jug.
    /// </summary>
    Single = 1,

    /// <summary>
    /// Basa — a bottle crate. 20 at 0.5 l, 24 at 0.33 l, but the count is recorded, not assumed.
    /// </summary>
    Crate = 2,

    /// <summary>
    /// A carried or shrink-wrapped pack of bottles or cans, from a duopack upwards.
    /// </summary>
    Multipack = 3,

    /// <summary>
    /// A tray of cans. Not a fixed size — 24 at 0.5 l but 12 at 0.33 l, which is exactly why the
    /// count cannot be derived from the container volume.
    /// </summary>
    Tray = 4
}
