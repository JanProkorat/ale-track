using AleTrack.Common.Enums;

namespace AleTrack.Features.Clients.Queries.Ledger;

/// <summary>
/// One recorded deviation, as the client profile, the order detail and the shipment read it.
/// </summary>
/// <remarks>
/// The difference between planned and actual is deliberately not on the wire: it is computed
/// where it is displayed. A third number could stop agreeing with the first two.
/// </remarks>
public sealed record ClientLedgerEntryDto
{
    /// <summary>Public ID of the entry.</summary>
    public Guid Id { get; set; }

    /// <summary>What diverged.</summary>
    public ClientLedgerEntryTarget Target { get; set; }

    /// <summary>The order this came off. Null for a standalone debt.</summary>
    public Guid? OrderId { get; set; }

    /// <summary>Delivery date of that order, so the row can name where it came from.</summary>
    public DateOnly? OrderRequiredDeliveryDate { get; set; }

    /// <summary>
    /// Delivery date of the shipment carrying that order, null while no run has it. The order's
    /// own required date is a promise; this is when it is actually going out.
    /// </summary>
    public DateTime? ShipmentDeliveryDate { get; set; }

    /// <summary>The stop it happened at.</summary>
    public Guid? StopId { get; set; }

    /// <summary>The affected beer line.</summary>
    public Guid? OrderItemId { get; set; }

    /// <summary>The affected product.</summary>
    public Guid? ProductId { get; set; }

    /// <summary>Product name as it was when the entry was written.</summary>
    public string? ProductName { get; set; }

    /// <summary>The affected supplier-good line.</summary>
    public Guid? SupplierGoodItemId { get; set; }

    /// <summary>The affected good, for one handed over with no line on the order.</summary>
    public Guid? SupplierGoodId { get; set; }

    /// <summary>Good name as it was when the entry was written.</summary>
    public string? GoodName { get; set; }

    /// <summary>The affected custom extra line.</summary>
    public Guid? CustomExtraItemId { get; set; }

    /// <summary>The affected returns line.</summary>
    public Guid? OrderReturnId { get; set; }

    /// <summary>Name of the affected line where no row is pointed at.</summary>
    public string? LineName { get; set; }

    /// <summary>What the plan said.</summary>
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

    /// <summary>Whether this is a debt to settle rather than a record.</summary>
    public bool RequiresFollowUp { get; set; }

    /// <summary>When it was settled.</summary>
    public DateTime? ResolvedAt { get; set; }

    /// <summary>How it was settled.</summary>
    public string? ResolutionNote { get; set; }

    /// <summary>
    /// The order carrying the settlement while <see cref="ResolvedAt"/> is still null — the
    /// entry is assigned, not yet resolved, and offers no manual close.
    /// </summary>
    public Guid? ResolvedByOrderId { get; set; }

    /// <summary>When it was written.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Who wrote it — the first question a disputed debt raises.</summary>
    public string? CreatedByUserName { get; set; }

    /// <summary>Who settled it.</summary>
    public string? ResolvedByUserName { get; set; }
}
