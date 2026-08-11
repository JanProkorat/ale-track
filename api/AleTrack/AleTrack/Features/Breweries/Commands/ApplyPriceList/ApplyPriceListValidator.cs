using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Breweries.Commands.ApplyPriceList;

/// <summary>
/// Validation rules for <see cref="ApplyPriceListRequest"/>.
/// </summary>
/// <remarks>
/// The hash is required rather than optional on purpose: an absent one would bind to null, compare
/// unequal, and surface as a conflict — which is safe but tells the caller the file changed when in
/// fact the request was malformed.
/// </remarks>
public sealed class ApplyPriceListValidator : Validator<ApplyPriceListRequest>
{
    public ApplyPriceListValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.File).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.EffectiveFrom).NotEqual(default(DateOnly))
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.SourceHash).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
    }
}
