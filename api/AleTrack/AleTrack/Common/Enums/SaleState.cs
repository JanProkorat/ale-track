namespace AleTrack.Common.Enums;

/// <summary>
/// Lifecycle of a garage sale. Stock moves on the transition to <see cref="Completed"/>.
/// </summary>
public enum SaleState
{
    /// <summary>
    /// Being assembled at the counter. Inventory is untouched and the record is freely editable.
    /// </summary>
    Draft,

    /// <summary>
    /// Handed over and settled — the sold pieces have been deducted from inventory, the money has
    /// arrived, and the record is frozen.
    /// </summary>
    Completed,

    /// <summary>
    /// Handed over but not yet paid: an invoiced sale whose goods have left the counter and whose
    /// stock is already deducted, waiting only for the money.
    /// </summary>
    /// <remarks>
    /// Appended rather than slotted between <see cref="Draft"/> and <see cref="Completed"/>, so the
    /// numeric order deliberately does not match the lifecycle order. These values are persisted as
    /// int, and renumbering them would rewrite the meaning of every existing row.
    /// </remarks>
    AwaitingPayment
}
