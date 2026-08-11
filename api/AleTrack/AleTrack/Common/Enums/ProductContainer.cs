namespace AleTrack.Common.Enums;

/// <summary>
/// The vessel the drink is physically in. Deliberately separate from how the product is sold —
/// a bottle can ship alone, in a crate or in a multipack — which <see cref="ProductSaleUnit"/> says.
/// </summary>
public enum ProductContainer
{
    /// <summary>
    /// Sud — a returnable KEG.
    /// </summary>
    Keg = 1,

    /// <summary>
    /// Standard returnable glass bottle, 0.33 l or 0.5 l.
    /// </summary>
    Bottle = 2,

    /// <summary>
    /// Plechovka. Includes the 2 l can Svijany lists under "PLECHOVKY 2L", which is a genuine can
    /// and not a jug.
    /// </summary>
    Can = 3,

    /// <summary>
    /// Džbán or dekorativní lahev — the 1 l and 2 l decorative glassware sold as a single piece.
    /// Separate from <see cref="Bottle"/> because it is never crated, and conflating the two is what
    /// made a 2 l jug display as a crate.
    /// </summary>
    Jug = 4,

    /// <summary>
    /// Anything else, including merchandise.
    /// </summary>
    Other = 5
}
