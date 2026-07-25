using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// An item the client wants that no brewery supplies. Used for both read and write —
/// <see cref="Id"/> is set on read and on updates of an existing row, null for
/// newly-added ones.
/// </summary>
public sealed record OrderCustomExtraItemDto
{
    /// <summary>Public ID of the item (null when newly added).</summary>
    public Guid? Id { get; set; }

    /// <summary>Description of the item.</summary>
    public string Description { get; set; } = null!;

    /// <summary>Quantity delivered to the client.</summary>
    public int Quantity { get; set; }

    /// <summary>Whether loading was confirmed. Owned by the shipment; ignored on order write.</summary>
    public bool IsLoadingConfirmed { get; set; }
}

/// <summary>
/// Validates a custom extra row: a non-empty description of at most 200 characters
/// (the limit on <see cref="Entities.OrderCustomExtraItem"/>) and a positive quantity.
/// </summary>
public sealed class OrderCustomExtraItemDtoValidator : Validator<OrderCustomExtraItemDto>
{
    public OrderCustomExtraItemDtoValidator()
    {
        RuleFor(e => e.Description).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(e => e.Description).MaximumLength(200).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(e => e.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}
