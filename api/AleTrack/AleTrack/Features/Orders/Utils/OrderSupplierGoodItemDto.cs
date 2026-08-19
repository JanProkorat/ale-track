using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// A line on an order that buys something off a supplier's price list. Used for both read
/// and write — <see cref="Id"/> is set on read and on updates of an existing row, null for
/// newly-added ones. The descriptive fields (<see cref="SupplierName"/>,
/// <see cref="GoodName"/>, the price) are read-only: they are resolved from the good and
/// ignored on write.
/// </summary>
public sealed record OrderSupplierGoodItemDto
{
    /// <summary>Public ID of the line (null when newly added).</summary>
    public Guid? Id { get; set; }

    /// <summary>Public ID of the ordered good. The only identifying field a write needs.</summary>
    public Guid SupplierGoodId { get; set; }

    /// <summary>Quantity ordered.</summary>
    public int Quantity { get; set; }

    /// <summary>Optional free-form note about this line.</summary>
    public string? Note { get; set; }

    /// <summary>Name of the good, for display. Read-only.</summary>
    public string? GoodName { get; set; }

    /// <summary>Size as the supplier states it — "10 kg", "50 l". Read-only.</summary>
    public string? GoodSize { get; set; }

    /// <summary>Public ID of the supplier the good belongs to. Read-only.</summary>
    public Guid? SupplierId { get; set; }

    /// <summary>Name of that supplier, for display. Read-only.</summary>
    public string? SupplierName { get; set; }

    /// <summary>
    /// Unit price with VAT, resolved live off the good's price list — its
    /// <see cref="SupplierChargeKind.Fill"/> price, or the first one it has. Read-only.
    /// </summary>
    /// <remarks>
    /// Live, not frozen: unlike a brewery product there is no snapshot of a supplier good's
    /// price yet, because these lines do not reach the shipment content snapshot. Null when
    /// the good somehow has no price at all, which the supplier validators forbid but a row
    /// written before them could still be.
    /// </remarks>
    public decimal? UnitPriceWithVat { get; set; }

    /// <summary>What that price charges for. Read-only.</summary>
    public SupplierChargeKind? ChargeKind { get; set; }
}

/// <summary>
/// Validates a supplier-good row: a good must be named, the quantity positive, and the note
/// at most 500 characters (the limit on <see cref="Entities.OrderSupplierGoodItem"/>).
/// </summary>
public sealed class OrderSupplierGoodItemDtoValidator : Validator<OrderSupplierGoodItemDto>
{
    public OrderSupplierGoodItemDtoValidator()
    {
        RuleFor(e => e.SupplierGoodId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(e => e.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
        RuleFor(e => e.Note)
            .MaximumLength(500)
            .When(e => e.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
