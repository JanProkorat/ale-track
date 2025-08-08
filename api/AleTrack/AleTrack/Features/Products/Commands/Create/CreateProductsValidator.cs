using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Products.Commands.Create;

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
        RuleFor(r => r.PriceWithVat).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.PriceForUnitWithVat).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.PriceForUnitWithoutVat).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Kind).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Type).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Name).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Name).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(r => r.Description)
            .MaximumLength(200)
            .When(r => r.Description != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(r => r.AlcoholPercentage)
            .NotNull()
            .When(r => 
                r.Type != ProductType.Merchandise && 
                r.Type != ProductType.Lemonade && 
                r.Type != ProductType.NonAlcoholicBeer)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}