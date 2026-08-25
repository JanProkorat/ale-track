namespace AleTrack.Features.Orders.Commands.Update;

/// <summary>
/// What the save invalidated on the run carrying this order.
/// </summary>
/// <remarks>
/// Editing an order can undo somebody else's work: a Fakturace row marked finished, a line ticked
/// off at the ramp. The server is where that is decided, so it is also the only place that knows
/// it happened — without this the screen would have to re-derive the rule to be able to say so,
/// and the copy would drift.
///
/// Empty on the ordinary save, which is most of them: a note, a date, a returns line.
/// </remarks>
public sealed record UpdateOrderResultDto
{
    /// <summary>
    /// Whether a Fakturace row covering this order was sent back for checking.
    /// </summary>
    public bool InvoicingUnmarked { get; set; }

    /// <summary>
    /// How many lines lost their loading tick because their count changed.
    /// </summary>
    public int LoadingChecksCleared { get; set; }

    /// <summary>Whether anything on the run was invalidated at all.</summary>
    public bool ChangedShipmentWork => InvoicingUnmarked || LoadingChecksCleared > 0;
}
