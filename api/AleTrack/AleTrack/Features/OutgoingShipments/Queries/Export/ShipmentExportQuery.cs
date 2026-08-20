using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Features.OutgoingShipments.Utils;
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
/// It does read the invoice split, though, because every product row reports both what is
/// delivered and what is billed — see <see cref="LoadInvoicedItemsAsync"/> for how, and why the
/// read reconciles without saving.
///
/// Split from the endpoint so the shaping — address resolution, product ordering, invoice
/// attribution — is testable against a mocked <c>DbContext</c> without going through HTTP or
/// opening a spreadsheet.
/// </remarks>
public static class ShipmentExportQuery
{
    /// <summary>
    /// Loads the export model of one shipment, or null when the shipment does not exist.
    /// </summary>
    /// <param name="dbContext">Database.</param>
    /// <param name="shipmentId">Public ID of the shipment.</param>
    /// <param name="company">
    /// Our own address, for the warehouse stop — it is configuration, not a row, so the stop itself
    /// carries only a label and coordinates.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<ShipmentExportModel?> LoadAsync(
        AleTrackDbContext dbContext,
        Guid shipmentId,
        CompanyOptions company,
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
                        Kind = s.Kind,
                        ClientId = s.ClientOrder != null ? s.ClientOrder.ClientId : null,
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
                                .Select(oi => new RawProduct
                                {
                                    SourceKind = InvoiceLineSourceKind.OrderItem,
                                    SourceItemId = oi.Id,
                                    Name = oi.Product.Name,
                                    Kind = oi.Product.Kind,
                                    PackageSize = oi.Product.PackageSize,
                                    Weight = oi.Product.Weight,
                                    Quantity = oi.Quantity
                                })
                                .ToList()
                            : new List<RawProduct>(),
                        // Things the client wants that no brewery supplies. Ordered products all the
                        // same, so they join the same table — last, and with no kind or package,
                        // because there is no product behind them to have either.
                        CustomExtras = s.ClientOrder != null
                            ? s.ClientOrder.CustomExtraItems
                                .OrderBy(e => e.Description)
                                .Select(e => new RawProduct
                                {
                                    SourceKind = InvoiceLineSourceKind.CustomExtraItem,
                                    SourceItemId = e.Id,
                                    Name = e.Description,
                                    Quantity = e.Quantity
                                })
                                .ToList()
                            : new List<RawProduct>(),
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

        var invoicedItems = await LoadInvoicedItemsAsync(dbContext, shipmentId, ct);

        // Which items each client delivers somewhere on this route, so a line billed to them can be
        // told apart from a line billed to them for goods they never receive.
        var deliveredKeysByClient = shipment.Stops
            .Where(s => s.ClientId is not null)
            .GroupBy(s => s.ClientId!.Value)
            .ToDictionary(
                g => g.Key,
                g => g.SelectMany(s => s.Products.Concat(s.CustomExtras))
                    .Select(p => (p.SourceKind, p.SourceItemId))
                    .ToHashSet());

        // A client can hold two stops on one route while holding one set of invoices. Pieces they
        // are billed for but receive nowhere on the route have no delivering stop to sit under, so
        // they go on the first stop that client has.
        var firstStopOrderByClient = shipment.Stops
            .Where(s => s.ClientId is not null)
            .GroupBy(s => s.ClientId!.Value)
            .ToDictionary(g => g.Key, g => g.Min(s => s.Order));

        return new ShipmentExportModel
        {
            ShipmentName = shipment.Name,
            DeliveryDate = shipment.DeliveryDate,
            VehicleName = shipment.VehicleName,
            DriverNames = shipment.DriverNames,
            Stops = shipment.Stops
                .Select(stop => ToStop(stop, company, shipment.StockPurchases, invoicedItems, deliveredKeysByClient, firstStopOrderByClient))
                .ToList(),
            StockPurchases = shipment.StockPurchases
        };
    }

    /// <summary>
    /// Pieces billed to each client, keyed by payer and billed item.
    /// </summary>
    /// <remarks>
    /// Reads the same graph the Fakturace section reads and reconciles it the same way, so the two
    /// cannot disagree: without the pass, a run nobody has opened Fakturace on yet has no stored
    /// lines at all and would export as "delivered 24, billed 0" for every row.
    ///
    /// Reconciles read-only and never saves — see <see cref="ShipmentInvoiceGraph.LoadReadOnlyAsync"/>.
    /// Exporting is reading, and it is gated on View; materialising a split as a side effect of
    /// downloading a file would let a viewer write one.
    ///
    /// Private lines are deliberately absent from the result: they are pieces kept off every
    /// invoice, so they are exactly what makes a billed number fall short of a delivered one.
    /// </remarks>
    private static async Task<Dictionary<(long ClientId, InvoiceLineSourceKind SourceKind, long SourceItemId), InvoicedItem>>
        LoadInvoicedItemsAsync(AleTrackDbContext dbContext, Guid shipmentId, CancellationToken ct)
    {
        var split = await ShipmentInvoiceGraph.LoadReadOnlyAsync(dbContext, shipmentId, ct);
        if (split is null)
            return [];

        ShipmentInvoiceReconciler.Reconcile(split);

        return split.Shipment.Invoices
            .SelectMany(invoice => invoice.Lines.Select(line => (invoice, line)))
            .GroupBy(x => (
                ClientId: x.invoice.ClientId,
                x.line.SourceKind,
                SourceItemId: ShipmentInvoiceGraph.SourceItemIdOf(x.line)))
            .ToDictionary(
                g => g.Key,
                g => new InvoicedItem
                {
                    // Off the line's own snapshot, like every displayed fact on an invoice: a
                    // product renamed after the split was made must not restate it.
                    Name = g.Select(x => x.line.ProductName).First(),
                    Kind = g.Select(x => x.line.Kind).First(),
                    PackageSize = g.Select(x => x.line.PackageSize).First(),
                    Quantity = g.Sum(x => x.line.Quantity)
                });
    }

    private static ShipmentExportStop ToStop(
        RawStop stop,
        CompanyOptions company,
        List<ShipmentExportProduct> stockPurchases,
        Dictionary<(long ClientId, InvoiceLineSourceKind SourceKind, long SourceItemId), InvoicedItem> invoicedItems,
        Dictionary<long, HashSet<(InvoiceLineSourceKind SourceKind, long SourceItemId)>> deliveredKeysByClient,
        Dictionary<long, int> firstStopOrderByClient)
    {
        if (stop.Kind == OutgoingShipmentStopKind.Company)
            return ToWarehouseStop(stop, company, stockPurchases);

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
            Products = BuildProducts(stop, invoicedItems, deliveredKeysByClient, firstStopOrderByClient),
            Returns = stop.Returns
        };
    }

    /// <summary>
    /// The call at our own warehouse: the goods bought for stock come off here.
    /// </summary>
    /// <remarks>
    /// Its address is configuration rather than a row — the stop carries a label and coordinates
    /// and nothing else — so it is spelled out from <see cref="CompanyOptions"/> the same way the
    /// route's start point is. Without it the overview listed the stop with no town and no piece
    /// count, and the goods it exists to unload appeared nowhere but a block at the foot of the
    /// overview.
    ///
    /// Nobody is billed for stock goods, so the rows keep their null billed count and the sheet
    /// renders the single quantity column.
    /// </remarks>
    private static ShipmentExportStop ToWarehouseStop(
        RawStop stop,
        CompanyOptions company,
        List<ShipmentExportProduct> stockPurchases) =>
        new()
        {
            Order = stop.Order,
            IsWarehouse = true,
            // The stop's own label is what the route was planned with; the configured name is the
            // fallback for a stop saved before it had one.
            Label = string.IsNullOrWhiteSpace(stop.Label) ? company.Name : stop.Label,
            Street = $"{company.StreetName} {company.StreetNumber}".Trim(),
            CityLine = $"{company.Zip} {company.City}".Trim(),
            City = company.City,
            Products = stockPurchases
        };

    /// <summary>
    /// The stop's product table: what it delivers, each row carrying what its client is billed for,
    /// then the rows that are billed here without being delivered here.
    /// </summary>
    private static List<ShipmentExportProduct> BuildProducts(
        RawStop stop,
        Dictionary<(long ClientId, InvoiceLineSourceKind SourceKind, long SourceItemId), InvoicedItem> invoicedItems,
        Dictionary<long, HashSet<(InvoiceLineSourceKind SourceKind, long SourceItemId)>> deliveredKeysByClient,
        Dictionary<long, int> firstStopOrderByClient)
    {
        var products = stop.Products
            .Concat(stop.CustomExtras)
            .Select(product => new ShipmentExportProduct
            {
                Name = product.Name,
                Kind = product.Kind,
                PackageSize = product.PackageSize,
                Weight = product.Weight,
                Quantity = product.Quantity,
                // A custom stop has no client and so no invoice — and no products either, so this
                // only guards the shape.
                InvoicedQuantity = stop.ClientId is null
                    ? null
                    : invoicedItems.TryGetValue(
                        (stop.ClientId.Value, product.SourceKind, product.SourceItemId), out var invoiced)
                        ? invoiced.Quantity
                        : 0
            })
            .ToList();

        if (stop.ClientId is null || firstStopOrderByClient[stop.ClientId.Value] != stop.Order)
            return products;

        var delivered = deliveredKeysByClient[stop.ClientId.Value];

        // Cross-billed in: another client ordered the pieces, this one pays for them. They belong in
        // this table because it answers "what goes on this client's invoice", and they carry no
        // delivered count or weight because this van hands them to somebody else.
        var crossBilled = invoicedItems
            .Where(entry => entry.Key.ClientId == stop.ClientId.Value
                            && !delivered.Contains((entry.Key.SourceKind, entry.Key.SourceItemId)))
            .Select(entry => new ShipmentExportProduct
            {
                Name = entry.Value.Name,
                Kind = entry.Value.Kind,
                PackageSize = entry.Value.PackageSize,
                Weight = null,
                Quantity = 0,
                InvoicedQuantity = entry.Value.Quantity
            })
            .OrderBy(product => product.Name, StringComparer.CurrentCulture);

        products.AddRange(crossBilled);
        return products;
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

        public OutgoingShipmentStopKind Kind { get; init; }

        /// <summary>
        /// Internal ID of the client delivered to — the key the invoice split is read by. Null for
        /// a custom stop.
        /// </summary>
        public long? ClientId { get; init; }

        public string? ClientName { get; init; }
        public string? Label { get; init; }
        public DeliveryAddressKind SelectedAddressKind { get; init; }
        public AddressDto? OfficialAddress { get; init; }
        public AddressDto? ContactAddress { get; init; }
        public string? DeliveryPlaceName { get; init; }
        public AddressDto? DeliveryPlaceAddress { get; init; }
        public List<string> Notes { get; init; } = [];
        public List<RawProduct> Products { get; init; } = [];
        public List<RawProduct> CustomExtras { get; init; } = [];
        public List<ShipmentExportReturn> Returns { get; init; } = [];
    }

    /// <summary>
    /// A delivered row before its billed count is known, carrying the identity an invoice line
    /// refers to it by.
    /// </summary>
    private sealed record RawProduct
    {
        public required InvoiceLineSourceKind SourceKind { get; init; }
        public required long SourceItemId { get; init; }
        public required string Name { get; init; }
        public ProductKind? Kind { get; init; }
        public double? PackageSize { get; init; }
        public double? Weight { get; init; }
        public required int Quantity { get; init; }
    }

    /// <summary>
    /// Pieces of one item that one client's invoices bill for, with the facts the line recorded
    /// about the item — needed when the row appears on no delivery table of its own.
    /// </summary>
    private sealed record InvoicedItem
    {
        public required string Name { get; init; }
        public ProductKind? Kind { get; init; }
        public double? PackageSize { get; init; }
        public required int Quantity { get; init; }
    }
}
