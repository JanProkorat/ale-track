using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Breweries.Commands.Delete;

/// <summary>
/// Validator for the <see cref="DeleteBreweryRequest"/>.
/// Ensures that the required properties of a delete Brewery request are valid.
/// </summary>
public sealed class DeleteBreweryValidator : Validator<DeleteBreweryRequest>
{
    public DeleteBreweryValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}