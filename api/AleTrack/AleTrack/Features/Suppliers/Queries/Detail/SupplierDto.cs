using AleTrack.Common.Models;

namespace AleTrack.Features.Suppliers.Queries.Detail;

/// <summary>
/// Everything one supplier holds: both addresses, contacts, the weekly schedule and the
/// price list.
/// </summary>
public sealed record SupplierDto
{
    /// <summary>
    /// Public ID of the supplier
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name of the supplier
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Registered business name, when it differs from the name
    /// </summary>
    public string? BusinessName { get; set; }

    /// <summary>
    /// Operational note — what a driver needs to know before setting off
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Registered seat, used for invoicing
    /// </summary>
    public AddressDto OfficialAddress { get; set; } = null!;

    /// <summary>
    /// Address of the branch actually visited, when it differs from the registered seat
    /// </summary>
    public AddressDto? ContactAddress { get; set; }

    /// <summary>
    /// Contacts on this supplier
    /// </summary>
    public List<SupplierContactDto> Contacts { get; set; } = [];

    /// <summary>
    /// Weekly recurring opening hours; a weekday with no interval is closed
    /// </summary>
    public List<SupplierOpeningHoursDto> OpeningHours { get; set; } = [];

    /// <summary>
    /// The price list, each good with one price per charge kind
    /// </summary>
    public List<SupplierGoodDto> Goods { get; set; } = [];
}
