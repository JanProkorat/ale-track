using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.Suppliers.Commands.Create;
using AleTrack.Features.Suppliers.Commands.Goods;
using AleTrack.Features.Suppliers.Commands.ReplaceOpeningHours;
using AleTrack.Features.Suppliers.Commands.Update;

namespace AleTrack.Tests.Builders;

public static class SupplierBuilder
{
    public static Supplier BuildEntity(
        Guid? publicId = null,
        long id = 1,
        string? name = null,
        string? businessName = null,
        string? note = null,
        Address? officialAddress = null,
        Address? contactAddress = null,
        List<SupplierContact>? contacts = null,
        List<SupplierOpeningHours>? openingHours = null,
        List<SupplierGood>? goods = null)
    {
        return new Supplier
        {
            Id = id,
            PublicId = publicId ?? Guid.NewGuid(),
            Name = name ?? "Linde Gas — plnírna Liberec",
            BusinessName = businessName,
            Note = note,
            OfficialAddress = officialAddress ?? AddressBuilder.BuildEntity(),
            ContactAddress = contactAddress,
            Contacts = contacts ?? [],
            OpeningHours = openingHours ?? [],
            Goods = goods ?? []
        };
    }

    public static SupplierOpeningHours BuildHours(DayOfWeek day, string from, string to, long id = 0)
        => new()
        {
            Id = id,
            DayOfWeek = day,
            From = TimeOnly.Parse(from),
            To = TimeOnly.Parse(to)
        };

    public static SupplierGood BuildGood(
        Guid? publicId = null,
        long id = 1,
        string? name = null,
        string? size = null,
        string? description = null,
        List<SupplierGoodPrice>? prices = null)
    {
        return new SupplierGood
        {
            Id = id,
            PublicId = publicId ?? Guid.NewGuid(),
            Name = name ?? "CO₂ láhev",
            Size = size ?? "10 kg",
            Description = description,
            Prices = prices ?? [BuildPrice(SupplierChargeKind.Fill, 450m, 372m)]
        };
    }

    public static SupplierGoodPrice BuildPrice(
        SupplierChargeKind kind,
        decimal withVat,
        decimal? withoutVat = null,
        string? note = null)
        => new()
        {
            Kind = kind,
            PriceWithVat = withVat,
            PriceWithoutVat = withoutVat,
            Note = note
        };

    public static CreateSupplierDto BuildCreateDto(
        string? name = null,
        string? businessName = null,
        string? note = null,
        AddressDto? officialAddress = null,
        AddressDto? contactAddress = null,
        List<SupplierContactUpsertDto>? contacts = null)
    {
        return new CreateSupplierDto
        {
            Name = name ?? "Linde Gas — plnírna Liberec",
            BusinessName = businessName,
            Note = note,
            OfficialAddress = officialAddress ?? AddressBuilder.BuildDto(),
            ContactAddress = contactAddress,
            Contacts = contacts ?? []
        };
    }

    public static UpdateSupplierDto BuildUpdateDto(
        string? name = null,
        string? businessName = null,
        string? note = null,
        AddressDto? officialAddress = null,
        AddressDto? contactAddress = null,
        List<SupplierContactUpsertDto>? contacts = null)
    {
        return new UpdateSupplierDto
        {
            Name = name ?? "Linde Gas — plnírna Liberec",
            BusinessName = businessName,
            Note = note,
            OfficialAddress = officialAddress ?? AddressBuilder.BuildDto(),
            ContactAddress = contactAddress,
            Contacts = contacts ?? []
        };
    }

    public static SupplierOpeningHoursUpsertDto BuildHoursDto(DayOfWeek day, string from, string to)
        => new() { DayOfWeek = day, From = TimeOnly.Parse(from), To = TimeOnly.Parse(to) };

    public static SupplierGoodUpsertDto BuildGoodUpsertDto(
        string? name = null,
        string? size = null,
        string? description = null,
        List<SupplierGoodPriceUpsertDto>? prices = null)
    {
        return new SupplierGoodUpsertDto
        {
            Name = name ?? "CO₂ láhev",
            Size = size ?? "10 kg",
            Description = description,
            Prices = prices ?? [BuildPriceUpsertDto(SupplierChargeKind.Fill, 450m, 372m)]
        };
    }

    public static SupplierGoodPriceUpsertDto BuildPriceUpsertDto(
        SupplierChargeKind kind,
        decimal withVat,
        decimal? withoutVat = null,
        string? note = null)
        => new()
        {
            Kind = kind,
            PriceWithVat = withVat,
            PriceWithoutVat = withoutVat,
            Note = note
        };
}
