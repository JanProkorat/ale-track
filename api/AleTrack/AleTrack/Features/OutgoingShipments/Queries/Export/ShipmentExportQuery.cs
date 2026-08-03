using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Reads everything the shipment export workbook needs and shapes it into a
/// <see cref="ShipmentExportModel"/>.
/// </summary>
/// <remarks>
/// A narrower read than the shipment detail: the export needs no purchase-invoice split, no
/// loading states, no preparation checklist and no sourcing detail, so it projects only the stops,
/// their goods and the run's own summary fields.
///
/// Split from the endpoint so the shaping — address resolution, product ordering — is testable
/// against a mocked <c>DbContext</c> without going through HTTP or opening a spreadsheet.
/// </remarks>
public static class ShipmentExportQuery
{
    /// <summary>
    /// Loads the export model of one shipment, or null when the shipment does not exist.
    /// </summary>
    public static async Task<ShipmentExportModel?> LoadAsync(
        AleTrackDbContext dbContext,
        Guid shipmentId,
        CancellationToken ct)
    {
        var shipment = await dbContext.OutgoingShipments
            .Where(os => os.PublicId == shipmentId)
            .Select(os => new RawShipment
            {
                Name = os.Name,
                DeliveryDate = os.DeliveryDate,
                VehicleName = os.Vehicle != null ? os.Vehicle.Name : null,
                DriverNames = os.Drivers
                    .OrderBy(d => d.Driver.LastName)
                    .ThenBy(d => d.Driver.FirstName)
                    .Select(d => d.Driver.FirstName + " " + d.Driver.LastName)
                    .ToList(),
                Stops = os.Stops
                    .OrderBy(s => s.Order)
                    .Select(s => new RawStop
                    {
                        Order = s.Order,
                        ClientName = s.ClientOrder != null ? s.ClientOrder.Client.Name : null,
                        Label = s.Label,
                        SelectedAddressKind = s.SelectedAddressKind,
                        OfficialAddress = s.ClientOrder != null ? s.ClientOrder.Client.OfficialAddress.ToDto() : null,
                        ContactAddress = s.ClientOrder != null && s.ClientOrder.Client.ContactAddress != null
                            ? s.ClientOrder.Client.ContactAddress.ToDto()
                            : null,
                        // No !IsDeleted condition, matching the shipment detail: a removed place must
                        // still render on the shipments that already used it.
                        DeliveryPlaceName = s.ClientDeliveryPlace != null ? s.ClientDeliveryPlace.Name : null,
                        DeliveryPlaceAddress = s.ClientDeliveryPlace != null
                            ? s.ClientDeliveryPlace.Address.ToDto()
                            : null,
                        Notes = s.ClientOrder != null
                            ? s.ClientOrder.Notes
                                .OrderBy(n => n.DateCreated)
                                .Select(n => n.Text)
                                .ToList()
                            : new List<string>(),
                        // Product order per ProductOrdering, deliberately without its brewery key:
                        // these sheets carry no brewery column, so grouping by a supplier the reader
                        // cannot see would look arbitrary. Reading by degree is what the customer
                        // asked for. Spelled out because EF cannot translate a method call here.
                        Products = s.ClientOrder != null
                            ? s.ClientOrder.OrderItems
                                .OrderBy(oi => oi.Product.Type == ProductType.Lemonade
                                            || oi.Product.Type == ProductType.Merchandise
                                            || oi.Product.Type == ProductType.Other ? 1 : 0)
                                .ThenBy(oi => oi.Product.PlatoDegree == null)
                                .ThenBy(oi => oi.Product.PlatoDegree)
                                .ThenBy(oi => oi.Product.PackageSize)
                                .ThenBy(oi => oi.Product.Name)
                                .Select(oi => new ShipmentExportProduct
                                {
                                    Name = oi.Product.Name,
                                    Kind = oi.Product.Kind,
                                    PackageSize = oi.Product.PackageSize,
                                    Weight = oi.Product.Weight,
                                    Quantity = oi.Quantity
                                })
                                .ToList()
                            : new List<ShipmentExportProduct>(),
                        // Things the client wants that no brewery supplies. Ordered products all the
                        // same, so they join the same table — last, and with no kind or package,
                        // because there is no product behind them to have either.
                        CustomExtras = s.ClientOrder != null
                            ? s.ClientOrder.CustomExtraItems
                                .OrderBy(e => e.Description)
                                .Select(e => new ShipmentExportProduct
                                {
                                    Name = e.Description,
                                    Quantity = e.Quantity
                                })
                                .ToList()
                            : new List<ShipmentExportProduct>(),
                        Returns = s.ClientOrder != null
                            ? s.ClientOrder.Returns
                                .OrderBy(r => r.Name)
                                .Select(r => new ShipmentExportReturn
                                {
                                    Name = r.Name,
                                    Note = r.Note,
                                    Quantity = r.Quantity
                                })
                                .ToList()
                            : new List<ShipmentExportReturn>()
                    })
                    .ToList(),
                // Product order per ProductOrdering; one brewery's goods per stock purchase row, so
                // the brewery key would sort nothing the reader can see here either.
                StockPurchases = os.StockPurchases
                    .OrderBy(ei => ei.Product.Type == ProductType.Lemonade
                                || ei.Product.Type == ProductType.Merchandise
                                || ei.Product.Type == ProductType.Other ? 1 : 0)
                    .ThenBy(ei => ei.Product.PlatoDegree == null)
                    .ThenBy(ei => ei.Product.PlatoDegree)
                    .ThenBy(ei => ei.Product.PackageSize)
                    .ThenBy(ei => ei.Product.Name)
                    .Select(ei => new ShipmentExportProduct
                    {
                        Name = ei.Product.Name,
                        Kind = ei.Product.Kind,
                        PackageSize = ei.Product.PackageSize,
                        Weight = ei.Product.Weight,
                        Quantity = ei.Quantity
                    })
                    .ToList()
            })
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        if (shipment is null)
            return null;

        return new ShipmentExportModel
        {
            ShipmentName = shipment.Name,
            DeliveryDate = shipment.DeliveryDate,
            VehicleName = shipment.VehicleName,
            DriverNames = shipment.DriverNames,
            Stops = shipment.Stops.Select(ToStop).ToList(),
            StockPurchases = shipment.StockPurchases
        };
    }

    private static ShipmentExportStop ToStop(RawStop stop)
    {
        var (street, cityLine, city) = ResolveAddress(stop);

        return new ShipmentExportStop
        {
            Order = stop.Order,
            ClientName = stop.ClientName,
            Label = stop.Label,
            Street = street,
            CityLine = cityLine,
            City = city,
            // Only reported when the stop actually delivers there. A stop that once picked a place
            // and was later pointed back at the client's own address still carries the place, and
            // naming it would claim a destination the van is not going to.
            DeliveryPlaceName = stop.SelectedAddressKind == DeliveryAddressKind.DeliveryPlace
                ? stop.DeliveryPlaceName
                : null,
            Notes = stop.Notes,
            Products = [.. stop.Products, .. stop.CustomExtras],
            Returns = stop.Returns
        };
    }

    /// <summary>
    /// Picks the address this stop actually delivers to and splits it into the sheet's lines.
    /// </summary>
    /// <remarks>
    /// Same rule as <c>resolveDetailStopAddress</c> / <c>resolveFromAddresses</c> on the client:
    /// the chosen delivery place wins, a Contact kind falls back to Official when the client has no
    /// contact address, and Official is the default.
    /// </remarks>
    private static (string? Street, string? CityLine, string? City) ResolveAddress(RawStop stop)
    {
        if (stop.SelectedAddressKind == DeliveryAddressKind.DeliveryPlace && stop.DeliveryPlaceAddress is not null)
            return SplitAddress(stop.DeliveryPlaceAddress);

        var address = stop.SelectedAddressKind == DeliveryAddressKind.Contact && stop.ContactAddress is not null
            ? stop.ContactAddress
            : stop.OfficialAddress;

        return address is null ? (null, null, null) : SplitAddress(address);
    }

    /// <summary>
    /// Splits an address into a street line and a zip-and-city line.
    /// </summary>
    /// <remarks>
    /// A delivery place pinned straight onto the map has neither street nor city, so its
    /// coordinates go where the city line would be — the same fallback
    /// <c>formatAddressOrCoords</c> applies on the client. Written as separate fields rather than
    /// one formatted line because a spreadsheet wants values, not sentences.
    /// </remarks>
    private static (string? Street, string? CityLine, string? City) SplitAddress(AddressDto address)
    {
        var street = string.Join(' ', new[] { address.StreetName, address.StreetNumber }
            .Where(part => !string.IsNullOrWhiteSpace(part)));

        var cityLine = string.Join(' ', new[] { address.Zip, address.City }
            .Where(part => !string.IsNullOrWhiteSpace(part)));

        if (street.Length == 0 && cityLine.Length == 0)
        {
            var coordinates = address.Latitude is not null && address.Longitude is not null
                ? FormattableString.Invariant($"{address.Latitude:F4}, {address.Longitude:F4}")
                : null;

            return (null, coordinates, null);
        }

        return (
            street.Length > 0 ? street : null,
            cityLine.Length > 0 ? cityLine : null,
            string.IsNullOrWhiteSpace(address.City) ? null : address.City);
    }

    /// <summary>
    /// What the projection reads, before the address is resolved and the extras folded in.
    /// </summary>
    private sealed record RawShipment
    {
        public string Name { get; init; } = null!;
        public DateTime? DeliveryDate { get; init; }
        public string? VehicleName { get; init; }
        public List<string> DriverNames { get; init; } = [];
        public List<RawStop> Stops { get; init; } = [];
        public List<ShipmentExportProduct> StockPurchases { get; init; } = [];
    }

    /// <summary>
    /// One projected stop, carrying every address candidate so the choice is made in memory.
    /// </summary>
    private sealed record RawStop
    {
        public int Order { get; init; }
        public string? ClientName { get; init; }
        public string? Label { get; init; }
        public DeliveryAddressKind SelectedAddressKind { get; init; }
        public AddressDto? OfficialAddress { get; init; }
        public AddressDto? ContactAddress { get; init; }
        public string? DeliveryPlaceName { get; init; }
        public AddressDto? DeliveryPlaceAddress { get; init; }
        public List<string> Notes { get; init; } = [];
        public List<ShipmentExportProduct> Products { get; init; } = [];
        public List<ShipmentExportProduct> CustomExtras { get; init; } = [];
        public List<ShipmentExportReturn> Returns { get; init; } = [];
    }
}
