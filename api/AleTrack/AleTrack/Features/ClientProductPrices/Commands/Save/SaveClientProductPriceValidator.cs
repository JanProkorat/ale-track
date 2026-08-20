using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.ClientProductPrices.Commands.Save;

/// <summary>
/// Validates a client product price write.
/// </summary>
internal sealed class SaveClientProductPriceValidator : Validator<SaveClientProductPriceRequest>
{
    /// <summary>
    /// Sets up the rules.
    /// </summary>
    public SaveClientProductPriceValidator()
    {
        RuleFor(x => x.Data.PriceWithVat)
            .GreaterThan(0m)
            .WithErrorCode(ErrorCodes.ClientProductPriceMustBePositive);
    }
}
