using AleTrack.Common.Enums;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Presentation-ready shape of one shipment export workbook: the run's summary and route, then the
/// confirmed rows of its invoice split.
/// </summary>
/// <remarks>
/// Deliberately free of entity and DTO types. The workbook builder receives nothing but strings,
/// numbers and enums, so it can be exercised without a database and the query can be exercised
/// without opening a spreadsheet.
///
/// Two audiences, in this order. <see cref="Stops"/> is the driver's page — the whole route, ready
/// or not. <see cref="Invoices"/> is the office's, and holds only the rows somebody has confirmed
/// as finished; the quantities in it come from the same reconciled split the Fakturace section
/// shows. Carries no money either way.
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
    /// Every stop on the route in route order, custom waypoints and the warehouse included. The
    /// overview lists all of them — including a stop whose row nobody has confirmed, since the van
    /// still calls there.
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
    /// Only the rows the office has confirmed as finished, in the order it confirmed them — see
    /// <see cref="ShipmentExportInvoice.Number"/>. An unconfirmed client is absent from here
    /// entirely, which is the point of the flag: the file is not to be read as final for a row
    /// still being edited.
    ///
    /// One block per invoice, not per paying client: a client holding invoices #1 and #2 on
    /// this run yields two blocks under the same number, each carrying its own
    /// <see cref="ShipmentExportInvoice.Sequence"/>.
    /// </remarks>
    public List<ShipmentExportInvoice> Invoices { get; init; } = [];

    /// <summary>
    /// Stops that deliver to a client, in route order. Counted on the overview as "Klientů", so the
    /// warehouse is deliberately not one of them.
    /// </summary>
    /// <remarks>
    /// One client holding two stops counts twice. The two deliveries go to different addresses and
    /// are genuinely separate drops, which is what the count is of.
    /// </remarks>
    public IEnumerable<ShipmentExportStop> ClientStops => Stops.Where(s => s.ClientName is not null);

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
/// <remarks>
/// Carries what the overview's route table reports and nothing else. Where the goods went, what the
/// order said and what comes back travel on <see cref="ShipmentExportInvoiceParty"/> instead: those
/// are read per client being billed, not per call the van makes, ever since the per-stop sheets went
/// away.
/// </remarks>
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
    /// It hands goods over like a client stop and reports them on the route table, but nobody is
    /// billed for them and it is not a client — the overview's client count leaves it out.
    /// </remarks>
    public bool IsWarehouse { get; init; }

    /// <summary>
    /// Town the stop is in, for the overview's route table.
    /// </summary>
    public string? City { get; init; }

    /// <summary>
    /// What is delivered here, in the app-wide product order, with the order's custom extra items
    /// last. Reported as a piece count on the route table, and weighed into the run's totals.
    /// </summary>
    public List<ShipmentExportProduct> Products { get; init; } = [];

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
    /// Pieces of this item the row is about: what an invoice party is billed for, or what the run
    /// buys for our own warehouse.
    /// </summary>
    public required int Quantity { get; init; }

    /// <summary>
    /// Pieces the van actually drops at the client's stop — "skutečně", against
    /// <see cref="Quantity"/>'s "fakturačně". Null where the question cannot be answered: the run's
    /// own stock purchases, which nobody is billed for, and a supplier good, which no stop carries.
    /// </summary>
    /// <remarks>
    /// The two differ exactly where the Fakturace section was edited: pieces kept off every invoice
    /// as soukromé bill less than they deliver, and pieces moved in from another client's order bill
    /// more — 0 delivered on a row the van hands over somewhere else entirely.
    /// </remarks>
    public int? DeliveredQuantity { get; init; }

}

/// <summary>
/// One paying client's invoice on the run, broken down by whose goods it bills.
/// </summary>
public sealed record ShipmentExportInvoice
{
    /// <summary>
    /// Number the office confirmed this client's row under, from 1 per run. What the office reads
    /// the file by, and the only ordering the invoice part uses.
    /// </summary>
    public required int Number { get; init; }

    public required string PayingClientName { get; init; }

    /// <summary>
    /// The paying client's trading name, when it has one. Named beside its own, because two clients
    /// can genuinely share a name and this is the page that gets filed.
    /// </summary>
    public string? PayingClientBusinessName { get; init; }

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
/// The goods of one client billed on an invoice, with the delivery they came from.
/// </summary>
/// <remarks>
/// The delivery details sit here rather than on the invoice because of the groups: a payer's
/// sub-clients are parties inside its invoice and have no block of their own, so an invoice-level
/// address would print the payer's — or none at all, since a payer need not take a delivery — and
/// lose every sub-client's note and vratka. For an ordinary single-party invoice the two are the
/// same.
///
/// Null address and empty lists for a party with no stop on this run: one whose goods the run only
/// bills, delivered on another. Both writers render nothing for it rather than a dash.
/// </remarks>
public sealed record ShipmentExportInvoiceParty
{
    public required string ClientName { get; init; }

    /// <summary>The paying client's own goods — listed first.</summary>
    public bool IsPayer { get; init; }

    /// <summary>Street line of where this party's goods went — <c>Dlouhá 14</c>.</summary>
    public string? Street { get; init; }

    /// <summary>Zip and city of the same — <c>602 00 Brno</c>, or coordinates for a pinned place.</summary>
    public string? CityLine { get; init; }

    /// <summary>Street and city on one line, for a writer with a single address column.</summary>
    public string AddressLine =>
        string.Join(", ", new[] { Street, CityLine }.Where(part => !string.IsNullOrWhiteSpace(part)));

    /// <summary>Name of the client's saved delivery place, when the goods went to one.</summary>
    public string? DeliveryPlaceName { get; init; }

    /// <summary>Notes on the order behind that delivery, oldest first.</summary>
    public List<string> Notes { get; init; } = [];

    /// <summary>Returnable items the client hands back against that order.</summary>
    public List<ShipmentExportReturn> Returns { get; init; } = [];

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
