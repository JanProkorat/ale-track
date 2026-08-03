using AleTrack.Common.Enums;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Presentation-ready shape of one shipment export workbook: the run's own summary plus one
/// entry per stop.
/// </summary>
/// <remarks>
/// Deliberately free of entity and DTO types. The workbook builder receives nothing but strings,
/// numbers and enums, so it can be exercised without a database and the query can be exercised
/// without opening a spreadsheet.
///
/// Carries no money and no invoice attribution: the export answers "who ordered which product",
/// not "who gets billed for it". That is why it reads the shipment's own stops rather than the
/// invoice split of the Fakturace section.
/// </remarks>
public sealed record ShipmentExportModel
{
    /// <summary>
    /// Name the planner gave the run.
    /// </summary>
    public required string ShipmentName { get; init; }

    /// <summary>
    /// Day the run is scheduled to deliver, or null when no date is set yet.
    /// </summary>
    public DateTime? DeliveryDate { get; init; }

    /// <summary>
    /// Name of the assigned vehicle, or null when none is assigned.
    /// </summary>
    public string? VehicleName { get; init; }

    /// <summary>
    /// Full names of the assigned drivers, alphabetically.
    /// </summary>
    public List<string> DriverNames { get; init; } = [];

    /// <summary>
    /// Every stop on the route in route order, custom stops included — the overview sheet lists
    /// all of them, while only the ones with a client get a sheet of their own.
    /// </summary>
    public List<ShipmentExportStop> Stops { get; init; } = [];

    /// <summary>
    /// Goods bought from the brewery on this run for our own warehouse. No client ordered them, so
    /// they get a block on the overview sheet rather than a sheet of their own.
    /// </summary>
    public List<ShipmentExportProduct> StockPurchases { get; init; } = [];

    /// <summary>
    /// Stops that deliver to a client, in route order — one sheet each.
    /// </summary>
    /// <remarks>
    /// One client holding two stops yields two sheets, not one merged sheet. The two deliveries go
    /// to different addresses and are genuinely separate drops; the stop number in the sheet name
    /// keeps them apart.
    /// </remarks>
    public IEnumerable<ShipmentExportStop> ClientStops => Stops.Where(s => s.ClientName is not null);

    /// <summary>
    /// Pieces the run carries in total, its own stock purchases included.
    /// </summary>
    public int TotalQuantity =>
        Stops.Sum(s => s.TotalQuantity) + StockPurchases.Sum(p => p.Quantity);

    /// <summary>
    /// Weight of everything the run carries, in kilograms. Products with no recorded weight
    /// contribute nothing.
    /// </summary>
    public double TotalWeight =>
        Stops.Sum(s => s.Products.Sum(p => (p.Weight ?? 0) * p.Quantity))
        + StockPurchases.Sum(p => (p.Weight ?? 0) * p.Quantity);
}

/// <summary>
/// One stop of the run — either a client delivery or a custom waypoint.
/// </summary>
public sealed record ShipmentExportStop
{
    /// <summary>
    /// Position of the stop on the route, starting at 1.
    /// </summary>
    public required int Order { get; init; }

    /// <summary>
    /// Name of the client delivered to, or null for a custom stop.
    /// </summary>
    public string? ClientName { get; init; }

    /// <summary>
    /// Label of a custom stop, or null for a client delivery.
    /// </summary>
    public string? Label { get; init; }

    /// <summary>
    /// Street line of the destination — <c>Dlouhá 14</c>. Null when the stop delivers to a place
    /// pinned on the map, which has no street.
    /// </summary>
    public string? Street { get; init; }

    /// <summary>
    /// Zip and city of the destination — <c>602 00 Brno</c>. Coordinates when the destination is
    /// a place pinned on the map.
    /// </summary>
    public string? CityLine { get; init; }

    /// <summary>
    /// City alone, for the overview sheet's stop table.
    /// </summary>
    public string? City { get; init; }

    /// <summary>
    /// Name of the client delivery place this stop delivers to, when it delivers to one.
    /// </summary>
    public string? DeliveryPlaceName { get; init; }

    /// <summary>
    /// Notes on the order behind this stop, oldest first.
    /// </summary>
    public List<string> Notes { get; init; } = [];

    /// <summary>
    /// What is delivered here, in the app-wide product order, with the order's custom extra items
    /// last.
    /// </summary>
    public List<ShipmentExportProduct> Products { get; init; } = [];

    /// <summary>
    /// Returnable items the client hands back at this stop.
    /// </summary>
    public List<ShipmentExportReturn> Returns { get; init; } = [];

    /// <summary>
    /// Pieces delivered at this stop.
    /// </summary>
    public int TotalQuantity => Products.Sum(p => p.Quantity);
}

/// <summary>
/// One product row of a stop, or of the run's stock purchases.
/// </summary>
public sealed record ShipmentExportProduct
{
    /// <summary>
    /// Display name of the product, or the description of a custom extra item.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Kind of the product. Null for a custom extra item, which no brewery supplies and which
    /// therefore has no product behind it.
    /// </summary>
    public ProductKind? Kind { get; init; }

    /// <summary>
    /// Package size in litres, when the item has a product.
    /// </summary>
    public double? PackageSize { get; init; }

    /// <summary>
    /// Weight of a single piece in kilograms, when recorded.
    /// </summary>
    public double? Weight { get; init; }

    /// <summary>
    /// Pieces of this item.
    /// </summary>
    public required int Quantity { get; init; }
}

/// <summary>
/// One returnable item handed back at a stop.
/// </summary>
public sealed record ShipmentExportReturn
{
    /// <summary>
    /// What is being handed back.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// The operator's note on it, when there is one.
    /// </summary>
    public string? Note { get; init; }

    /// <summary>
    /// Pieces handed back.
    /// </summary>
    public required int Quantity { get; init; }
}
