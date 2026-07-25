using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.ClientDeliveryPlaces.Commands;

/// <summary>
/// Body for creating or updating a client delivery place.
/// </summary>
public sealed record SaveClientDeliveryPlaceDto
{
    /// <summary>
    /// Name shown in the picker
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Instruction for the driver
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Postal parts of the place. All four text fields may be empty when the
    /// place was picked straight off the map.
    /// </summary>
    public AddressDto Address { get; set; } = null!;

    /// <summary>
    /// Latitude of the place. Always required — a place must be plottable.
    /// </summary>
    public decimal Latitude { get; set; }

    /// <summary>
    /// Longitude of the place
    /// </summary>
    public decimal Longitude { get; set; }

    /// <summary>
    /// Country of the place. Nullable because <see cref="Country"/> starts at 1,
    /// so an omitted field would otherwise arrive as the invalid value 0. The
    /// handler substitutes <see cref="Country.Czechia"/> when this is null.
    /// </summary>
    public Country? Country { get; set; }
}

/// <summary>
/// Validator for <see cref="SaveClientDeliveryPlaceDto"/>.
/// </summary>
public sealed class SaveClientDeliveryPlaceDtoValidator : Validator<SaveClientDeliveryPlaceDto>
{
    public SaveClientDeliveryPlaceDtoValidator()
    {
        RuleFor(dto => dto.Address)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(dto => dto.Name)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        RuleFor(dto => dto.Name)
            .MaximumLength(100)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);

        RuleFor(dto => dto.Note)
            .MaximumLength(200)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);

        RuleFor(dto => dto.Country!.Value)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.ValidationEnumError)
            .When(dto => dto.Country.HasValue);
    }
}

/// <summary>
/// Maps the write DTO onto the owned <see cref="Address"/>.
/// </summary>
public static class SaveClientDeliveryPlaceDtoExtensions
{
    /// <summary>
    /// Builds the owned address. Empty postal parts are stored as null rather
    /// than "", so "has no address" is one value and not two. The null-forgiving
    /// operators below are deliberate: the shared <see cref="Address"/> CLR type
    /// declares these string properties non-nullable (other entities require
    /// them), but <see cref="AleTrack.Infrastructure.Persistence.Configurations.ClientDeliveryPlaceConfiguration"/>
    /// relaxes them to nullable columns for this entity specifically, since a
    /// map-picked place has no postal parts at all.
    /// </summary>
    public static Address ToAddress(this SaveClientDeliveryPlaceDto dto) => new()
    {
        StreetName = Blank(dto.Address.StreetName)!,
        StreetNumber = Blank(dto.Address.StreetNumber)!,
        City = Blank(dto.Address.City)!,
        Zip = Blank(dto.Address.Zip)!,
        Country = dto.Country ?? Common.Enums.Country.Czechia,
        Latitude = dto.Latitude,
        Longitude = dto.Longitude
    };

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
