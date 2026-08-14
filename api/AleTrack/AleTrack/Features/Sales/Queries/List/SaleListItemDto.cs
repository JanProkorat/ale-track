using AleTrack.Common.Enums;

namespace AleTrack.Features.Sales.Queries.List;

/// <summary>
/// One row of the garage-sales list.
/// </summary>
/// <remarks>
/// The due date is flattened out of the billing block rather than nested, because the list's overdue
/// badge keys off it and would otherwise have to reach into an object that is null for every cash
/// sale. Whether the sale is paid is not carried at all — that is <see cref="State"/>.
/// </remarks>
public sealed record SaleListItemDto
{
    /// <summary>
    /// Public ID of the sale.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Date the goods changed hands.
    /// </summary>
    public DateOnly SaleDate { get; set; }

    /// <summary>
    /// Lifecycle state of the sale.
    /// </summary>
    public SaleState State { get; set; }

    /// <summary>
    /// Whether the buyer is an existing client or a one-off walk-in.
    /// </summary>
    public SaleBuyerKind BuyerKind { get; set; }

    /// <summary>
    /// Name of a walk-in buyer, if one was recorded.
    /// </summary>
    public string? BuyerName { get; set; }

    /// <summary>
    /// Public ID of the buying client, when the buyer is one.
    /// </summary>
    public Guid? ClientId { get; set; }

    /// <summary>
    /// Name of the buying client, when the buyer is one.
    /// </summary>
    public string? ClientName { get; set; }

    /// <summary>
    /// How the sale is paid for.
    /// </summary>
    public SalePaymentMethod Payment { get; set; }

    /// <summary>
    /// Date an invoiced sale is due.
    /// </summary>
    public DateOnly? DueDate { get; set; }

    /// <summary>
    /// Total pieces sold across all lines.
    /// </summary>
    public int TotalQuantity { get; set; }

    /// <summary>
    /// Total charged across all lines, with VAT.
    /// </summary>
    public decimal TotalPrice { get; set; }
}
