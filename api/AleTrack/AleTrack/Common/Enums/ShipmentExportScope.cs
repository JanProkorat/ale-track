namespace AleTrack.Common.Enums;

/// <summary>
/// How much of what happened to a run an export file carries.
/// </summary>
/// <remarks>
/// Three files off one run, because they are read by different people at different moments: the
/// paper that went out before the van did, the correction sent after it came back, and the whole
/// picture for whoever has neither.
///
/// Deviations live beside the order rather than in it (see <see cref="ClientLedgerEntryTarget"/>),
/// which is what makes all three readable from the same data. Before a run is filed it has no
/// deviations at all, so every scope yields the same file.
/// </remarks>
public enum ShipmentExportScope
{
    /// <summary>
    /// The order as it was planned, deviations ignored — the paper printed before the run left.
    /// </summary>
    /// <remarks>
    /// Value 0, and the default: this is what every export produced before the scope existed, so a
    /// caller that names none keeps getting the file it already knows.
    /// </remarks>
    Plan = 0,

    /// <summary>
    /// Only what diverged: the clients and lines a deviation touched, with the plan beside it.
    /// </summary>
    /// <remarks>
    /// The delta. Whoever needs it already holds the <see cref="Plan"/> file, and a run of twenty
    /// stops that changed in two is unreadable as a correction if it arrives whole.
    /// </remarks>
    Changed = 1,

    /// <summary>
    /// The plan and every deviation against it — what actually happened, in full.
    /// </summary>
    All = 2
}
