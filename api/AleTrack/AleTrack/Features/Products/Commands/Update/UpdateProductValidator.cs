using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Products.Commands.Update;

/// <summary>
/// Validator for the <see cref="UpdateProductRequest"/> class.
/// Ensures that the product update request contains valid values for its properties.
/// </summary>
public sealed class UpdateProductValidator : Validator<UpdateProductRequest>
{
    public UpdateProductValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateProductDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="UpdateProductDto"/> class.
/// Ensures that the product DTO contains valid values for its properties.
/// </summary>
public sealed class UpdateProductDtoValidator : Validator<UpdateProductDto>
{
    public UpdateProductDtoValidator()
    {
        RuleFor(r => r.Price).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Name).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Name).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Description)
            .MaximumLength(200)
            .When(r => r.Description != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}