namespace AleTrack.Common.Enums;

/// <summary>
/// Who the buyer of a garage sale is.
/// </summary>
public enum SaleBuyerKind
{
    /// <summary>
    /// An existing <see cref="Entities.Client"/> from the client book.
    /// </summary>
    Client,

    /// <summary>
    /// A one-off buyer recorded by name only, with no client record behind them.
    /// </summary>
    Walkin
}
