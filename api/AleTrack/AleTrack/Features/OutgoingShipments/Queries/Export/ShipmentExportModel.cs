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
/// Carries no money, but it does carry invoice attribution: every product row reports both what
/// the van drops at the stop and what lands on that client's invoices, which is the pair the
/// office reads the file for. The quantities come from the same reconciled split the Fakturace
/// section shows — see <see cref="ShipmentExportProduct.InvoicedQuantity"/>.
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
    /// Every stop on the route in route order, custom waypoints and the warehouse included — the
    /// overview sheet lists all of them, while only the ones that hand goods over get a sheet of
    /// their own.
    /// </summary>
    public List<ShipmentExportStop> Stops { get; init; } = [];

    /// <summary>
    /// Goods bought from the brewery on this run for our own warehouse.
    /// </summary>
    /// <remarks>
    /// Also the warehouse stop's own product table, when the run has one — the pieces come off the
    /// van there, and that stop is where a driver reads what to unload. Kept on the model as well
    /// so a run that carries stock goods without a warehouse stop still reports them somewhere; see
    /// <see cref="HasWarehouseStop"/>.
    /// </remarks>
    public List<ShipmentExportProduct> StockPurchases { get; init; } = [];

    /// <summary>
    /// Invoice split of the run, one block per invoice, each block broken down by the client
    /// whose goods are billed on it.
    /// </summary>
    /// <remarks>
    /// One block per invoice, not per paying client: a client holding invoices #1 and #2 on
    /// this run yields two blocks, each carrying its own <see cref="ShipmentExportInvoice.Sequence"/>.
    ///
    /// Additive: the stop entries are untouched, because what the driver reads did not change.
    /// This part exists for the office, and it is the only place a paying client with no
    /// delivery of its own appears at all.
    /// </remarks>
    public List<ShipmentExportInvoice> Invoices { get; init; } = [];

    /// <summary>
    /// Stops that deliver to a client, in route order. Counted on the overview as "Klientů", so the
    /// warehouse is deliberately not one of them.
    /// </summary>
    /// <remarks>
    /// One client holding two stops yields two sheets, not one merged sheet. The two deliveries go
    /// to different addresses and are genuinely separate drops; the stop number in the sheet name
    /// keeps them apart.
    /// </remarks>
    public IEnumerable<ShipmentExportStop> ClientStops => Stops.Where(s => s.ClientName is not null);

    /// <summary>
    /// Stops that get a sheet of their own: every client delivery, plus the warehouse when the run
    /// calls at it. A custom waypoint hands nothing over and so has nothing to list.
    /// </summary>
    public IEnumerable<ShipmentExportStop> SheetStops =>
        Stops.Where(s => s.ClientName is not null || s.IsWarehouse);

    /// <summary>
    /// Whether the run calls at our own warehouse — which is where its stock purchases come off.
    /// </summary>
    public bool HasWarehouseStop => Stops.Any(s => s.IsWarehouse);

    /// <summary>
    /// Pieces the run carries in total, its own stock purchases included.
    /// </summary>
    /// <remarks>
    /// The stock purchases are added only when no warehouse stop carries them already, or a run
    /// with one would count them twice.
    /// </remarks>
    public int TotalQuantity =>
        Stops.Sum(s => s.TotalQuantity)
        + (HasWarehouseStop ? 0 : StockPurchases.Sum(p => p.Quantity));

    /// <summary>
    /// Weight of everything the run carries, in kilograms. Products with no recorded weight
    /// contribute nothing.
    /// </summary>
    public double TotalWeight =>
        Stops.Sum(s => s.Products.Sum(p => (p.Weight ?? 0) * p.Quantity))
        + (HasWarehouseStop ? 0 : StockPurchases.Sum(p => (p.Weight ?? 0) * p.Quantity));
}

/// <summary>
/// One stop of the run — a client delivery, our own warehouse, or a custom waypoint.
/// </summary>
public sealed record ShipmentExportStop
{
    /// <summary>
    /// Position of the stop on the route, starting at 1.
    /// </summary>
    public required int Order { get; init; }

    /// <summary>
    /// Name of the client delivered to, or null for a warehouse or custom stop.
    /// </summary>
    public string? ClientName { get; init; }

    /// <summary>
    /// Label of a warehouse or custom stop, or null for a client delivery.
    /// </summary>
    public string? Label { get; init; }

    /// <summary>
    /// Whether this is the call at our own warehouse, where the run's stock purchases come off.
    /// </summary>
    /// <remarks>
    /// It hands goods over like a client stop and so gets a sheet, but nobody is billed for them
    /// and it is not a client — the overview's client count leaves it out.
    /// </remarks>
    public bool IsWarehouse { get; init; }

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
    /// Name of the client this stop's goods are invoiced to, when that is not the stop's own
    /// client. Null in the ordinary case.
    /// </summary>
    public string? InvoicedToClientName { get; init; }

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

    /// <summary>
    /// Pieces billed to this stop's client, across every invoice they hold on the run.
    /// </summary>
    public int TotalInvoicedQuantity => Products.Sum(p => p.InvoicedQuantity ?? 0);
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
    /// Pieces of this item the van actually drops — "skutečně".
    /// </summary>
    public required int Quantity { get; init; }

    /// <summary>
    /// Pieces of this item that land on the invoices of the client whose table this is —
    /// "fakturačně" — or null where the question does not apply, which is the run's own stock
    /// purchases: nobody is billed for goods bought into our warehouse.
    /// </summary>
    /// <remarks>
    /// Differs from <see cref="Quantity"/> exactly where the Fakturace section was edited: pieces
    /// moved onto another client's invoice, or kept off every invoice as soukromé, bill less than
    /// they deliver, and pieces moved in from another client's order bill more. A row that bills
    /// pieces this stop does not deliver at all — cross-billed in — carries
    /// <see cref="Quantity"/> 0.
    /// </remarks>
    public int? InvoicedQuantity { get; init; }
}

/// <summary>
/// One paying client's invoice on the run, broken down by whose goods it bills.
/// </summary>
public sealed record ShipmentExportInvoice
{
    public required string PayingClientName { get; init; }

    /// <summary>
    /// Public ID of the paying client — the identity the "more than one invoice" heading rule
    /// keys on, since names collide (that is what <c>BusinessName</c> exists for) but IDs don't.
    /// </summary>
    public required Guid PayingClientId { get; init; }

    /// <summary>Position among that client's invoices on this run, starting at 1.</summary>
    public int Sequence { get; init; }

    public List<ShipmentExportInvoiceParty> Parties { get; init; } = [];

    public int TotalQuantity => Parties.Sum(p => p.TotalQuantity);

    /// <summary>
    /// Sub-clients whose official address the office chose to name on this invoice, for the
    /// payer to raise its own invoices against. Empty when none were chosen, in which case
    /// both writers render no section for it at all.
    /// </summary>
    public List<ShipmentExportBillingRecipient> BillingRecipients { get; init; } = [];
}

/// <summary>
/// One sub-client named on a payer's invoice as an address to invoice, with the address as it was
/// recorded on the invoice — never the client's current one.
/// </summary>
public sealed record ShipmentExportBillingRecipient
{
    public required string ClientName { get; init; }

    /// <summary>Street line — <c>Hlavní 12</c>.</summary>
    public string? Street { get; init; }

    /// <summary>Zip and city line — <c>602 00 Brno</c>.</summary>
    public string? CityLine { get; init; }

    /// <summary>Street and city joined onto one line, for a writer with a single address column.</summary>
    public string AddressLine =>
        string.Join(", ", new[] { Street, CityLine }.Where(part => !string.IsNullOrWhiteSpace(part)));
}

/// <summary>
/// The goods of one client billed on an invoice.
/// </summary>
/// <remarks>
/// Rows carry their billed pieces in <see cref="ShipmentExportProduct.Quantity"/> and leave
/// <see cref="ShipmentExportProduct.InvoicedQuantity"/> null: inside an invoice block there is
/// only one number to report.
/// </remarks>
public sealed record ShipmentExportInvoiceParty
{
    public required string ClientName { get; init; }

    /// <summary>The paying client's own goods — listed first.</summary>
    public bool IsPayer { get; init; }

    public List<ShipmentExportProduct> Products { get; init; } = [];

    public int TotalQuantity => Products.Sum(p => p.Quantity);
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
