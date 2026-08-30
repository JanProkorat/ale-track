using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.Clients.Utils;

/// <summary>
/// One deviation to record, with its foreign keys already resolved to internal ids.
/// </summary>
/// <remarks>
/// Deliberately in internal ids rather than public ones: the endpoints translate at their
/// boundary, and the automatic writers (the delivery-address ones) already hold entities. The
/// alternative — resolving public ids inside the writer — would have made every automatic
/// caller look up ids it was already holding.
/// </remarks>
public sealed record ClientLedgerLine
{
    /// <summary>What diverged.</summary>
    public required ClientLedgerEntryTarget Target { get; init; }

    /// <summary>The affected <see cref="OrderItem"/>, for a planned beer line.</summary>
    public long? OrderItemId { get; init; }

    /// <summary>The affected <see cref="Product"/>.</summary>
    public long? ProductId { get; init; }

    /// <summary>Product name at the time of writing.</summary>
    public string? ProductName { get; init; }

    /// <summary>The affected <see cref="OrderSupplierGoodItem"/>.</summary>
    public long? SupplierGoodItemId { get; init; }

    /// <summary>The affected <see cref="SupplierGood"/>, for a good with no line on the order.</summary>
    public long? SupplierGoodId { get; init; }

    /// <summary>Good name at the time of writing.</summary>
    public string? GoodName { get; init; }

    /// <summary>The affected <see cref="OrderCustomExtraItem"/>.</summary>
    public long? CustomExtraItemId { get; init; }

    /// <summary>The affected <see cref="OrderReturn"/>.</summary>
    public long? OrderReturnId { get; init; }

    /// <summary>
    /// Name of the affected line where there is no row to point at — a return the order never
    /// planned, an extra named on the spot.
    /// </summary>
    public string? LineName { get; init; }

    /// <summary>What the plan said. Zero for something never planned at all.</summary>
    public int? PlannedQuantity { get; init; }

    /// <summary>What actually changed hands.</summary>
    public int? ActualQuantity { get; init; }

    /// <summary>The old address.</summary>
    public string? PlannedText { get; init; }

    /// <summary>The new address.</summary>
    public string? ActualText { get; init; }

    /// <summary>Money owed, signed: positive means the client owes us.</summary>
    public decimal? Amount { get; init; }

    /// <summary>Why it happened.</summary>
    public string? Note { get; init; }
}

/// <summary>
/// Where a batch of deviations came from: whose they are, and off which delivery.
/// </summary>
public sealed record ClientLedgerScope(long ClientId, long? OrderId, long? StopId);
