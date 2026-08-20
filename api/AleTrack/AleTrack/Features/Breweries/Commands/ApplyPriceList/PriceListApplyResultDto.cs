namespace AleTrack.Features.Breweries.Commands.ApplyPriceList;

/// <summary>
/// What an applied price list did.
/// </summary>
public sealed record PriceListApplyResultDto
{
    /// <summary>
    /// Public ID of the provenance row this import wrote.
    /// </summary>
    public required Guid ImportId { get; init; }

    /// <summary>Products created.</summary>
    public required int Added { get; init; }

    /// <summary>Products repriced or otherwise changed.</summary>
    public required int Updated { get; init; }

    /// <summary>Products removed. Soft, so recoverable.</summary>
    public required int Removed { get; init; }

    /// <summary>Products the list dropped but which are in use, and were kept.</summary>
    public required int Blocked { get; init; }
}
