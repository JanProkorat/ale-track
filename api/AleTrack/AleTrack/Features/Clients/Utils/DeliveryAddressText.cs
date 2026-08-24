using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Utils;

/// <summary>
/// Renders a delivery destination as the one line a ledger entry stores.
/// </summary>
/// <remarks>
/// The ledger keeps addresses as text rather than as a (kind, place) pair, because the pair
/// stops meaning anything once the place is renamed or removed — and "where was it supposed to
/// go" is the question the entry exists to answer. It is a snapshot for the same reason the
/// product name is.
/// </remarks>
public static class DeliveryAddressText
{
    /// <summary>
    /// Renders a stop's or an order's destination, resolving the delivery place when the kind
    /// calls for one.
    /// </summary>
    public static async Task<string?> RenderAsync(
        AleTrackDbContext dbContext,
        Client client,
        DeliveryAddressKind kind,
        long? placeId,
        CancellationToken ct)
    {
        ClientDeliveryPlace? place = null;

        if (kind == DeliveryAddressKind.DeliveryPlace && placeId is not null)
        {
            // Soft-deleted places are deliberately still resolved: the entry describes where the
            // van went, and removing the place afterwards does not change that.
            place = await dbContext.ClientDeliveryPlaces
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(p => p.Id == placeId, ct);
        }

        return Render(client, kind, place);
    }

    /// <summary>
    /// Renders a destination from already-loaded entities.
    /// </summary>
    /// <remarks>
    /// The fallback chain matches what the order detail, the stop and the export all display:
    /// a delivery place if that is the kind, otherwise the contact or official address,
    /// whichever the client has.
    /// </remarks>
    public static string? Render(Client client, DeliveryAddressKind kind, ClientDeliveryPlace? place)
    {
        if (kind == DeliveryAddressKind.DeliveryPlace && place is not null)
        {
            var line = Render(place.Address);
            return line is null ? place.Name : $"{place.Name}, {line}";
        }

        var address = kind == DeliveryAddressKind.Contact && client.ContactAddress is not null
            ? client.ContactAddress
            : client.OfficialAddress ?? client.ContactAddress;

        return Render(address);
    }

    /// <summary>
    /// One line: street, number, zip, city.
    /// </summary>
    public static string? Render(Address? address) =>
        address is null
            ? null
            : $"{address.StreetName} {address.StreetNumber}, {address.Zip} {address.City}".Trim();
}
