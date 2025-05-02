using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Clients.Commands.Delete;

/// <summary>
/// Validator for the <see cref="DeleteClientRequest"/>.
/// Ensures that the required properties of a delete client request are valid.
/// </summary>
public sealed class DeleteClientValidator : Validator<DeleteClientRequest>
{
    public DeleteClientValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}