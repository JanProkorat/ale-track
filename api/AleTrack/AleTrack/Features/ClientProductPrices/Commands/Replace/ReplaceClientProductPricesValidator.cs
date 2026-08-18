using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.ClientProductPrices.Commands.Replace;

/// <summary>
/// Validates a whole-list client price write.
/// </summary>
internal sealed class ReplaceClientProductPricesValidator : Validator<ReplaceClientProductPricesRequest>
{
    /// <summary>
    /// Sets up the rules.
    /// </summary>
    public ReplaceClientProductPricesValidator()
    {
        RuleFor(x => x.Data)
            .Must(entries => entries.Select(e => e.ProductId).Distinct().Count() == entries.Count)
            .WithErrorCode(ErrorCodes.ClientProductPriceDuplicateProduct);

        RuleForEach(x => x.Data).ChildRules(entry =>
        {
            entry.RuleFor(e => e.PriceWithVat)
                .GreaterThan(0m)
                .WithErrorCode(ErrorCodes.ClientProductPriceMustBePositive);
        });
    }
}
