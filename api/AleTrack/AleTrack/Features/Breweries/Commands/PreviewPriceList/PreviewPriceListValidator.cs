using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Breweries.Commands.PreviewPriceList;

/// <summary>
/// Validation rules for <see cref="PreviewPriceListRequest"/>.
/// </summary>
/// <remarks>
/// A missing multipart field is not a binding error — it simply leaves the property at its default,
/// so without a rule here an upload with no date would be previewed as effective 0001-01-01 and the
/// user would only notice once the provenance row said so.
/// </remarks>
public sealed class PreviewPriceListValidator : Validator<PreviewPriceListRequest>
{
    public PreviewPriceListValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.File).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.EffectiveFrom).NotEqual(default(DateOnly))
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);
    }
}
