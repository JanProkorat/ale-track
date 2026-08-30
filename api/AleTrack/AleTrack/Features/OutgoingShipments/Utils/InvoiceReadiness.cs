namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// When an order's paperwork is finished, which is what opens recording a deviation against it.
/// </summary>
/// <remarks>
/// The rule: the Fakturace row covering this order is marked ready. Two consequences follow from
/// how that row is keyed, and both are easy to get wrong.
///
/// <list type="number">
/// <item>The row belongs to the <em>paying</em> client. A sub-client billed through a payer has no
/// row of its own — see <see cref="Entities.OutgoingShipmentInvoiceConfirmation"/> — so the lookup
/// resolves <c>Client.InvoicingClientId ?? Client.Id</c> before matching. Matching on the ordering
/// client would leave every sub-client's order permanently unrecordable.</item>
/// <item>Readiness is deliberately not a lock: the office can still fix a row after ticking it. So
/// a deviation recorded afterwards still reaches the invoice through reconciliation, which is what
/// makes "record after the papers are done" a safe order of work rather than a contradiction.</item>
/// </list>
///
/// Deliberately not gated on the shipment's state, which is what this replaced. State said "the
/// van has left", and that is not the same question: at <c>Loaded</c> the papers need not be
/// finished, and the order screen would then offer editing the plan under them.
///
/// The predicate itself is spelled out at each of the two read sites rather than shared from here —
/// EF cannot inline a method call into a projection. This type is where the rule is written down;
/// <c>InvoiceReadinessTests</c> is what keeps the two copies honest.
/// </remarks>
public static class InvoiceReadiness
{
    /// <summary>
    /// Internal ID of the client whose Fakturace row covers an order: its payer when it has one,
    /// otherwise the ordering client itself.
    /// </summary>
    /// <remarks>
    /// The in-memory counterpart of the projected predicate, for callers holding loaded entities.
    /// </remarks>
    public static long RowClientIdOf(Entities.Order order) =>
        order.Client?.InvoicingClientId ?? order.ClientId;

    /// <summary>
    /// Whether the row covering <paramref name="order"/> is finished on the run carrying it.
    /// </summary>
    /// <param name="shipment">Run whose confirmations are loaded.</param>
    /// <param name="order">Order to judge.</param>
    public static bool IsReadyFor(Entities.OutgoingShipment shipment, Entities.Order order) =>
        shipment.InvoiceConfirmations.Any(c => c.IsReady && c.ClientId == RowClientIdOf(order));
}
