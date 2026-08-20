using AleTrack.Common.Enums;

namespace AleTrack.Features.Suppliers.Queries;

/// <summary>
/// A supplier's phone number or e-mail address. Shared by the list and the detail so the
/// generated client gets one type rather than two identically shaped ones.
/// </summary>
public sealed record SupplierContactDto
{
    /// <summary>
    /// Whether the value is an e-mail address or a phone number
    /// </summary>
    public ContactType Type { get; set; }

    /// <summary>
    /// What this contact is for, such as "Plnírna"
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// The phone number or e-mail address itself
    /// </summary>
    public string Value { get; set; } = null!;
}

/// <summary>
/// One weekly-recurring opening interval.
/// </summary>
/// <remarks>
/// Several entries may share a <see cref="DayOfWeek"/> — that is a lunch break. A weekday
/// absent from the collection is closed. A nonstop point is 00:00–23:59; the frontend
/// renders that pair as "nonstop" rather than as a range.
/// </remarks>
public sealed record SupplierOpeningHoursDto
{
    /// <summary>
    /// Weekday the interval falls on. <see cref="System.DayOfWeek"/>, so Sunday is 0.
    /// </summary>
    public DayOfWeek DayOfWeek { get; set; }

    /// <summary>
    /// When the interval opens
    /// </summary>
    public TimeOnly From { get; set; }

    /// <summary>
    /// When the interval closes
    /// </summary>
    public TimeOnly To { get; set; }
}

/// <summary>
/// What a good costs for one charge kind.
/// </summary>
public sealed record SupplierGoodPriceDto
{
    /// <summary>
    /// What this price charges for
    /// </summary>
    public SupplierChargeKind Kind { get; set; }

    /// <summary>
    /// Price with VAT, in CZK
    /// </summary>
    public decimal PriceWithVat { get; set; }

    /// <summary>
    /// Price without VAT, when the supplier states it
    /// </summary>
    public decimal? PriceWithoutVat { get; set; }

    /// <summary>
    /// Qualifier the price makes no sense without, such as "za měsíc"
    /// </summary>
    public string? Note { get; set; }
}

/// <summary>
/// One item on a supplier's price list, with a price per charge kind.
/// </summary>
public sealed record SupplierGoodDto
{
    /// <summary>
    /// Public ID of the goods
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name of the goods
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Size as the supplier states it — "10 kg", "50 l", "20 ks"
    /// </summary>
    public string? Size { get; set; }

    /// <summary>
    /// Further detail, such as the gas grade
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Where a run collects this good — our own garage, or the supplier's premises. Decides
    /// which pickup stop a shipment carrying it grows.
    /// </summary>
    public SupplierGoodPickupSource PickupSource { get; set; }

    /// <summary>
    /// Prices, one per charge kind
    /// </summary>
    public List<SupplierGoodPriceDto> Prices { get; set; } = [];
}
