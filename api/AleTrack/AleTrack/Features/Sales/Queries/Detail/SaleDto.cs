using AleTrack.Common.Enums;

namespace AleTrack.Features.Sales.Queries.Detail;

/// <summary>
/// Full detail of a garage sale.
/// </summary>
public sealed record SaleDto
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
    /// Billing details. Null for a cash sale.
    /// </summary>
    public SaleBillingDetailDto? Billing { get; set; }

    /// <summary>
    /// Free-form note about the sale.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// When the sale was completed and the stock deducted.
    /// </summary>
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>
    /// Name of the user who rang the sale up.
    /// </summary>
    public string? SoldByUserName { get; set; }

    /// <summary>
    /// Lines sold.
    /// </summary>
    public List<SaleItemDetailDto> Items { get; set; } = [];
}
