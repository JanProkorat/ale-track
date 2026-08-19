using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Suppliers.Commands.Goods;

/// <summary>
/// One price-list item as it arrives from the editor, prices included.
/// </summary>
/// <remarks>
/// Prices travel with the goods rather than through endpoints of their own: the drawer edits
/// a good and its charge kinds as one thing, and "at least one price" and "no duplicate
/// kinds" are rules about the set, which only holds together if the set arrives whole.
/// Shared by create and update — the two carry identical fields.
/// </remarks>
public sealed record SupplierGoodUpsertDto
{
    /// <summary>
    /// Name of the goods, such as "CO₂ láhev"
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Size as the supplier states it — "10 kg", "50 l", "20 ks"
    /// </summary>
    public string? Size { get; set; }

    /// <summary>
    /// Further detail, such as the gas grade or thread standard
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Where a run collects this good — our own garage, or the supplier's premises. Decides
    /// which pickup stop a shipment carrying it grows.
    /// </summary>
    public SupplierGoodPickupSource PickupSource { get; set; }

    /// <summary>
    /// One price per charge kind. At least one, kinds unique.
    /// </summary>
    public List<SupplierGoodPriceUpsertDto> Prices { get; set; } = [];
}

/// <summary>
/// One price on a good, as it arrives from the editor.
/// </summary>
public sealed record SupplierGoodPriceUpsertDto
{
    /// <summary>
    /// What this price charges for
    /// </summary>
    public SupplierChargeKind Kind { get; set; }

    /// <summary>
    /// Price with VAT, in CZK
    /// </summary>
    public decimal PriceWithVat { get; set; }

    /// <summary>
    /// Price without VAT, when the supplier states it
    /// </summary>
    public decimal? PriceWithoutVat { get; set; }

    /// <summary>
    /// Qualifier the price makes no sense without, such as "za měsíc"
    /// </summary>
    public string? Note { get; set; }
}

/// <summary>
/// Validation rules for a good and its prices, shared by create and update.
/// </summary>
public sealed class SupplierGoodUpsertDtoValidator : Validator<SupplierGoodUpsertDto>
{
    public SupplierGoodUpsertDtoValidator()
    {
        RuleFor(r => r.Name).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Name).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Size).MaximumLength(20).When(x => x.Size != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Description).MaximumLength(200).When(x => x.Description != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);

        RuleFor(r => r.PickupSource).IsInEnum().WithErrorCode(ErrorCodes.ValidationError);

        // A good with no price is not a price-list entry.
        RuleFor(r => r.Prices).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError)
            .WithMessage("Zadejte alespoň jednu cenu.");

        // Matches the unique (good, kind) index, so the ceník can group each good once with
        // its kinds beneath it — and so a client mistake answers 400 rather than a DB error.
        RuleFor(r => r.Prices)
            .Must(prices => prices.Select(p => p.Kind).Distinct().Count() == prices.Count)
            .WithErrorCode(ErrorCodes.ValidationError)
            .WithMessage("Každý účel může mít jen jednu cenu.");

        RuleForEach(r => r.Prices).SetValidator(new SupplierGoodPriceUpsertDtoValidator());
    }
}

/// <summary>
/// Validation rules for one price row.
/// </summary>
public sealed class SupplierGoodPriceUpsertDtoValidator : Validator<SupplierGoodPriceUpsertDto>
{
    public SupplierGoodPriceUpsertDtoValidator()
    {
        RuleFor(r => r.Kind).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.PriceWithVat).GreaterThanOrEqualTo(0).WithErrorCode(ErrorCodes.ValidationError);
        RuleFor(r => r.PriceWithoutVat).GreaterThanOrEqualTo(0).When(x => x.PriceWithoutVat != null)
            .WithErrorCode(ErrorCodes.ValidationError);
        RuleFor(r => r.Note).MaximumLength(100).When(x => x.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
