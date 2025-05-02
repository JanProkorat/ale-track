using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Products.Commands.Ceate;

/// <summary>
/// Validator for the <see cref="CreateProductsRequest"/> class.
/// Ensures that the request contains valid data.
/// </summary>
public sealed class CreateProductsValidator : Validator<CreateProductsRequest>
{
    public CreateProductsValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}

/// <summary>
/// Validator for the <see cref="CreateProductsDto"/> class.
/// Ensures that the DTO contains valid data.
/// </summary>
public sealed class CreateProductsDtoValidator : Validator<CreateProductsDto>
{
    public CreateProductsDtoValidator()
    {
        RuleFor(r => r.Products).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
    }
}

/// <summary>
/// Validator for the <see cref="CreateProductDto"/> class.
/// Ensures that the product DTO contains valid values for its properties.
/// </summary>
public sealed class CreateProductDtoValidator : Validator<CreateProductDto>
{
    public CreateProductDtoValidator()
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