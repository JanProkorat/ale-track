using AleTrack.Common.Models;

namespace AleTrack.Features.Suppliers.Queries.List;

/// <summary>
/// One row of the Dodavatelé list.
/// </summary>
/// <remarks>
/// Deliberately richer than <c>ClientListItemDto</c>, which carries only id/name/region and
/// leaves the list screen to fetch a detail per row for its address and contact columns.
/// The suppliers list needs strictly more than that — the address, the contacts, how many
/// goods are priced and the whole week of opening hours for the "Dnes" column — so serving
/// it here is one round trip instead of 1 + N.
///
/// The payload stays small: a supplier has at most a couple of contacts and roughly a dozen
/// opening intervals.
/// </remarks>
public sealed record SupplierListItemDto
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
    /// Registered seat, shown in the Sídlo column
    /// </summary>
    public AddressDto OfficialAddress { get; set; } = null!;

    /// <summary>
    /// Contacts, shown as chips in the list
    /// </summary>
    public List<SupplierContactDto> Contacts { get; set; } = [];

    /// <summary>
    /// How many goods the supplier prices
    /// </summary>
    public int GoodsCount { get; set; }

    /// <summary>
    /// Names of the goods, so the list can be searched by what a supplier sells.
    /// </summary>
    /// <remarks>
    /// "Who refills Biogon" is how the question actually arrives, and a supplier's own name
    /// never contains it. Names only — the list needs no prices, and sending them would put
    /// the whole price list on a screen that shows none of it.
    /// </remarks>
    public List<string> GoodNames { get; set; } = [];

    /// <summary>
    /// The whole weekly schedule, from which the client computes open/closed against the
    /// viewer's own clock. Not a server-computed flag: it would be stale as soon as the
    /// response is cached, and it would answer a question about the viewer's time zone
    /// from the server's.
    /// </summary>
    public List<SupplierOpeningHoursDto> OpeningHours { get; set; } = [];
}
