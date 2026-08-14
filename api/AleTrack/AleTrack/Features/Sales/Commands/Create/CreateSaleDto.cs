using AleTrack.Common.Enums;
using AleTrack.Features.Sales.Utils;

namespace AleTrack.Features.Sales.Commands.Create;

/// <summary>
/// Data required to record a new garage sale.
/// </summary>
/// <remarks>
/// A sale is always created as a draft — the stock is not touched until it is completed — so this
/// payload deliberately carries no state field.
/// </remarks>
public sealed record CreateSaleDto
{
    /// <summary>
    /// Date the goods changed hands.
    /// </summary>
    public DateOnly SaleDate { get; set; }

    /// <summary>
    /// Whether the buyer is an existing client or a one-off walk-in.
    /// </summary>
    public SaleBuyerKind BuyerKind { get; set; }

    /// <summary>
    /// Public ID of the buying client. Required when <see cref="BuyerKind"/> is
    /// <see cref="SaleBuyerKind.Client"/>, forbidden otherwise.
    /// </summary>
    public Guid? ClientId { get; set; }

    /// <summary>
    /// Name of a walk-in buyer. Optional — an anonymous cash sale needs no name.
    /// </summary>
    public string? BuyerName { get; set; }

    /// <summary>
    /// How the sale is paid for.
    /// </summary>
    public SalePaymentMethod Payment { get; set; }

    /// <summary>
    /// Billing details. Required when <see cref="Payment"/> is
    /// <see cref="SalePaymentMethod.Invoice"/>, ignored otherwise.
    /// </summary>
    public SaleBillingDto? Billing { get; set; }

    /// <summary>
    /// Free-form note about the sale.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Lines sold.
    /// </summary>
    public List<SaleItemDto> Items { get; set; } = [];
}
