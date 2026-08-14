using AleTrack.Common.Enums;
using AleTrack.Features.Sales.Utils;

namespace AleTrack.Features.Sales.Commands.Update;

/// <summary>
/// Data required to change a draft garage sale.
/// </summary>
/// <remarks>
/// Structurally the same as the create payload: a draft is edited by replacing its content, and
/// there is no partial-update path. The paid flag is absent deliberately — it is owned by the
/// set-paid command, so marking an invoice paid never means reopening the sale.
/// </remarks>
public sealed record UpdateSaleDto
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
    /// Name of a walk-in buyer.
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
    /// Lines sold. Replaces the existing lines wholesale.
    /// </summary>
    public List<SaleItemDto> Items { get; set; } = [];
}
