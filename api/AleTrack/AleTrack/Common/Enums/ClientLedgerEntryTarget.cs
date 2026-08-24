namespace AleTrack.Common.Enums;

/// <summary>
/// What a client ledger entry is about — <em>which</em> part of the order reality diverged
/// from the plan.
/// </summary>
/// <remarks>
/// Deliberately a taxonomy of targets rather than of events: "three kegs not unloaded" and
/// "three crates taken at the door" are the same arithmetic with opposite signs, so an
/// event-shaped enum would make every consumer carry two branches for one concept and would
/// grow with each new scenario. The wording shown to the user is derived from the sign.
///
/// There is no value for the delivery date: it is not changed once the run has left, so the
/// entry would never be written. Values are appended here rather than reordered — the same
/// practice <see cref="InvoiceLineSourceKind"/> follows — so adding one later is safe.
/// </remarks>
public enum ClientLedgerEntryTarget
{
    /// <summary>A quantity of a beer line. Carries the order item and the product.</summary>
    ProductQuantity = 0,

    /// <summary>A quantity of a supplier-good line.</summary>
    SupplierGoodQuantity = 1,

    /// <summary>A quantity of a custom extra item.</summary>
    CustomExtraQuantity = 2,

    /// <summary>
    /// A quantity of returnable packaging handed back. Has no good direction: short means the
    /// client still owes empties, over means we are holding deposits that are not ours.
    /// </summary>
    ReturnQuantity = 3,

    /// <summary>
    /// Where the goods actually went. Informational — a record, never a debt.
    /// </summary>
    DeliveryAddress = 4,

    /// <summary>
    /// Money owed in either direction, signed: positive means the client owes us.
    /// </summary>
    Money = 5,

    /// <summary>Anything else worth carrying into the next order.</summary>
    Other = 6
}
