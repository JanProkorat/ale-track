using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Users.Commands.Refresh;

/// <summary>
/// Validator for the refresh token request
/// </summary>
public sealed class RefreshTokenValidator : Validator<RefreshTokenRequest>
{
    public RefreshTokenValidator()
    {
        RuleFor(x => x.Data)
            .NotNull();

        RuleFor(x => x.Data.RefreshToken)
            .NotEmpty()
            .When(x => x.Data is not null);
    }
}
