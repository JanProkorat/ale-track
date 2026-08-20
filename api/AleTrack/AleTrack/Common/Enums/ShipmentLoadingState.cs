namespace AleTrack.Common.Enums;

/// <summary>
/// How far a product has got through loading, for one brewery-invoice column of a shipment.
/// </summary>
/// <remarks>
/// The nakládka is loaded in two passes: the pieces are read out and put in the van, then
/// counted back. Both passes used to be checkboxes — the first persisted on the order item, the
/// second not persisted at all — which is why this is a state rather than a pair of flags.
/// </remarks>
public enum ShipmentLoadingState
{
    /// <summary>Nothing done yet.</summary>
    NotLoaded = 0,

    /// <summary>Read out and loaded — the first pass ("nadiktováno").</summary>
    Dictated = 1,

    /// <summary>Counted back and confirmed — the second pass ("zkontrolováno").</summary>
    Checked = 2
}
