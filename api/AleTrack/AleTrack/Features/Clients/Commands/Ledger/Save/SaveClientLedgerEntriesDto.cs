using AleTrack.Common.Enums;

namespace AleTrack.Features.Clients.Commands.Ledger.Save;

/// <summary>
/// A batch of deviations recorded in one go — everything the recording drawer collected about
/// one handover.
/// </summary>
/// <remarks>
/// Batched rather than one request per row because the operator sees one form: pieces, returns
/// and extras of one stop are one decision, and half-saving them would leave a client half in
/// debt.
/// </remarks>
public sealed record SaveClientLedgerEntriesDto
{
    /// <summary>
    /// The order the deviations came off. Omitted for a standalone debt with no delivery
    /// behind it.
    /// </summary>
    public Guid? OrderId { get; set; }

    /// <summary>The rows. Ones where reality matches the plan are dropped, not stored.</summary>
    public List<ClientLedgerRowDto> Rows { get; set; } = [];
}

/// <summary>
/// One recorded deviation.
/// </summary>
public sealed record ClientLedgerRowDto
{
    /// <summary>What diverged.</summary>
    public ClientLedgerEntryTarget Target { get; set; }

    /// <summary>The affected beer line, for something the order planned.</summary>
    public Guid? OrderItemId { get; set; }

    /// <summary>
    /// The affected product. Set without <see cref="OrderItemId"/> for a product the client
    /// took at the door, which has no order line to point at.
    /// </summary>
    public Guid? ProductId { get; set; }

    /// <summary>The affected supplier-good line.</summary>
    public Guid? SupplierGoodItemId { get; set; }

    /// <summary>
    /// The affected good. Set without <see cref="SupplierGoodItemId"/> for a good handed over at
    /// the door, which has no order line to point at — the mirror of <see cref="ProductId"/>.
    /// </summary>
    public Guid? SupplierGoodId { get; set; }

    /// <summary>The affected custom extra line.</summary>
    public Guid? CustomExtraItemId { get; set; }

    /// <summary>The affected returns line.</summary>
    public Guid? OrderReturnId { get; set; }

    /// <summary>
    /// Name of the line where there is no row to point at — empties handed over against an
    /// order that planned no returns, an extra named on the spot.
    /// </summary>
    public string? LineName { get; set; }

    /// <summary>
    /// What the plan said — which, once the run has left, is what was <em>loaded</em>. Zero for
    /// something never planned at all.
    /// </summary>
    public int? PlannedQuantity { get; set; }

    /// <summary>What actually changed hands.</summary>
    public int? ActualQuantity { get; set; }

    /// <summary>The old address.</summary>
    public string? PlannedText { get; set; }

    /// <summary>The new address.</summary>
    public string? ActualText { get; set; }

    /// <summary>Money owed, signed: positive means the client owes us.</summary>
    public decimal? Amount { get; set; }

    /// <summary>Why it happened.</summary>
    public string? Note { get; set; }
}
