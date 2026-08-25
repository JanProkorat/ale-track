using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static AleTrack.Features.OutgoingShipments.Queries.Export.ShipmentExportLabels;

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
/// It does read the invoice split, though — that is the body of the file, and only the rows the
/// office has confirmed reach it. See <see cref="LoadInvoicedItemsAsync"/> for how, and why the read
/// reconciles without saving.
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
    /// <param name="clientIds">
    /// Public IDs of the confirmed rows to carry, or null for every one of them. The office picks
    /// them in the export drawer, so a run confirmed over a morning can send only what is new.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<ShipmentExportModel?> LoadAsync(
        AleTrackDbContext dbContext,
        Guid shipmentId,
        CompanyOptions company,
        IReadOnlyCollection<Guid>? clientIds,
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
                        OfficialAddress = s.ClientOrder != null && s.ClientOrder.Client.OfficialAddress != null
                            ? s.ClientOrder.Client.OfficialAddress.ToDto()
                            : null,
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

        var invoicedSplit = await LoadInvoicedItemsAsync(dbContext, shipmentId, clientIds, ct);

        // Where each client's goods went, for the parties of the invoice part. The per-stop sheets
        // that used to carry the address, the order's notes and its vratky are gone, so the party
        // whose goods they are carries them instead. A client with two stops on one run takes the
        // first, exactly as the Fakturace screen does.
        // What the van drops for each client, per item — the "skutečně" beside every billed row.
        // Summed over that client's stops, because one client can take two drops on one run.
        var deliveredByClientItem = shipment.Stops
            .Where(s => s.ClientId is not null)
            .SelectMany(s => s.Products
                .Concat(s.CustomExtras)
                .Select(product => (ClientId: s.ClientId!.Value, Product: product)))
            .GroupBy(x => (x.ClientId, x.Product.SourceKind, x.Product.SourceItemId))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Product.Quantity));

        var deliveryByClient = shipment.Stops
            .Where(s => s.ClientId is not null)
            .GroupBy(s => s.ClientId!.Value)
            .ToDictionary(g => g.Key, g => ToDelivery(g.OrderBy(s => s.Order).First()));

        return new ShipmentExportModel
        {
            ShipmentName = shipment.Name,
            DeliveryDate = shipment.DeliveryDate,
            VehicleName = shipment.VehicleName,
            DriverNames = shipment.DriverNames,
            Stops = shipment.Stops
                .Select(stop => ToStop(stop, company, shipment.StockPurchases))
                .ToList(),
            StockPurchases = shipment.StockPurchases,
            Invoices = BuildInvoices(invoicedSplit, deliveryByClient, deliveredByClientItem)
        };
    }

    /// <summary>
    /// Pieces billed on the run, keyed three ways — by payer, by (payer, orderer) and by
    /// (invoice, orderer) — see <see cref="InvoicedSplit"/> for which part reads which.
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
    private static async Task<InvoicedSplit> LoadInvoicedItemsAsync(
        AleTrackDbContext dbContext,
        Guid shipmentId,
        IReadOnlyCollection<Guid>? clientIds,
        CancellationToken ct)
    {
        var split = await ShipmentInvoiceGraph.LoadReadOnlyAsync(dbContext, shipmentId, ct);
        if (split is null)
            return InvoicedSplit.Empty;

        ShipmentInvoiceReconciler.Reconcile(split);

        var shipment = split.Shipment;
        var orderers = OrderersBySource(split);
        var lines = shipment.Invoices.SelectMany(invoice => invoice.Lines.Select(line =>
        {
            var sourceItemId = ShipmentInvoiceGraph.SourceItemIdOf(line);

            // A line whose source has left the run cannot survive reconciliation, so the fallback
            // only guards the shape — attributing it to the invoice's own client keeps it inside a
            // block rather than dropping pieces somebody is billed for.
            var orderer = orderers.GetValueOrDefault(
                (line.SourceKind, sourceItemId),
                (ClientId: invoice.ClientId, Name: invoice.Client?.Name ?? Missing));

            return new BilledLine(
                invoice.ClientId, invoice.PublicId, orderer.ClientId, orderer.Name,
                line.SourceKind, sourceItemId, line);
        })).ToList();

        // One name per paying client, so an invoice whose own Client navigation happens to be null
        // still resolves through a sibling invoice of the same client rather than printing a dash.
        var payerNames = shipment.Invoices
            .GroupBy(i => i.ClientId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(i => i.Client?.Name).FirstOrDefault(name => name is not null) ?? Missing);

        // Public ID of each paying client — the identity the export's "more than one invoice"
        // heading rule keys on, since two distinct clients can genuinely share a name.
        var payerPublicIds = shipment.Invoices
            .GroupBy(i => i.ClientId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(i => i.Client?.PublicId).FirstOrDefault(id => id is not null) ?? Guid.Empty);

        // Optional, so no Missing fallback: a client without one simply has none to print.
        var payerBusinessNames = shipment.Invoices
            .GroupBy(i => i.ClientId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(i => i.Client?.BusinessName).FirstOrDefault(name => name is not null));

        // The row's own stored address, never the client's current one — a delivered run must
        // export what it was sent with, exactly as the Fakturace screen shows it.
        var recipientsByInvoice = shipment.Invoices.ToDictionary(
            i => i.PublicId,
            i => i.BillingRecipients
                .Select(r =>
                {
                    var (street, cityLine, _) = SplitAddress(r.Address.ToDto());
                    return new ShipmentExportBillingRecipient
                    {
                        ClientName = r.Client?.Name ?? Missing,
                        Street = street,
                        CityLine = cityLine
                    };
                })
                .OrderBy(r => r.ClientName, StringComparer.CurrentCulture)
                .ToList());

        return new InvoicedSplit
        {
            // The office's own numbering, and what decides which invoices reach the file at all. An
            // un-marked row keeps its number so re-marking gives it back, so readiness is read here
            // rather than the number's mere presence.
            // Ready *and* chosen. A null selection means every ready row, which is what a caller
            // that does not choose — the query's own tests — reads.
            ReadyNumberByPayer = shipment.InvoiceConfirmations
                .Where(c => c.IsReady)
                .Where(c => clientIds is null || clientIds.Contains(c.Client?.PublicId ?? Guid.Empty))
                .ToDictionary(c => c.ClientId, c => c.Number),
            ByInvoiceAndOrderer = lines
                .GroupBy(x => (x.InvoiceId, x.OrdererId, x.SourceKind, x.SourceItemId))
                .ToDictionary(g => g.Key, ToInvoicedItem),
            // Read off the invoices rather than off the lines, so an invoice that is currently
            // empty still resolves an identity — it just contributes no block.
            Invoices = shipment.Invoices.ToDictionary(
                i => i.PublicId,
                i => (
                    PayerId: i.ClientId,
                    PayerPublicId: payerPublicIds[i.ClientId],
                    Sequence: i.Sequence,
                    Name: payerNames[i.ClientId],
                    BusinessName: payerBusinessNames[i.ClientId])),
            OrdererNames = lines
                .GroupBy(x => x.OrdererId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.OrdererName).First()),
            RecipientsByInvoice = recipientsByInvoice
        };
    }

    /// <summary>
    /// Ordering client of every billable item on the run, keyed the way an invoice line refers to
    /// its source.
    /// </summary>
    /// <remarks>
    /// A line does not record who ordered the pieces — see the remarks on
    /// <see cref="OutgoingShipmentInvoiceLine"/> — so the attribution is derived from the source
    /// item's own order, exactly as the Fakturace screen derives it.
    /// </remarks>
    private static Dictionary<(InvoiceLineSourceKind SourceKind, long SourceItemId), (long ClientId, string Name)>
        OrderersBySource(ShipmentInvoiceSplit split)
    {
        var orderers =
            new Dictionary<(InvoiceLineSourceKind SourceKind, long SourceItemId), (long ClientId, string Name)>();

        var shipment = split.Shipment;

        foreach (var order in shipment.Stops.Where(s => s.ClientOrder is not null).Select(s => s.ClientOrder!))
        {
            var orderer = (ClientId: order.ClientId, Name: order.Client?.Name ?? Missing);

            foreach (var item in order.OrderItems)
                orderers[(InvoiceLineSourceKind.OrderItem, item.Id)] = orderer;

            foreach (var extra in order.CustomExtraItems)
                orderers[(InvoiceLineSourceKind.CustomExtraItem, extra.Id)] = orderer;

            foreach (var good in order.SupplierGoodItems)
                orderers[(InvoiceLineSourceKind.SupplierGoodItem, good.Id)] = orderer;

            // Nothing to attribute for now — the ledger stays out of invoicing, so the split
            // carries no entries. Kept because a ledger-sourced line has no order item to key on:
            // its pieces would fall back to the invoice's own client and land in the wrong block
            // whenever a payer differs from the orderer.
            foreach (var entry in split.LedgerEntries.Where(e => e.OrderId == order.Id))
                orderers[(InvoiceLineSourceKind.LedgerEntry, entry.Id)] = orderer;
        }

        return orderers;
    }

    /// <summary>
    /// Facts off the line's own snapshot, like every displayed fact on an invoice: a product
    /// renamed after the split was made must not restate it.
    /// </summary>
    private static InvoicedItem ToInvoicedItem<TKey>(IGrouping<TKey, BilledLine> group) =>
        new()
        {
            Name = group.Select(x => x.Line.ProductName).First(),
            Kind = group.Select(x => x.Line.Kind).First(),
            PackageSize = group.Select(x => x.Line.PackageSize).First(),
            Quantity = group.Sum(x => x.Line.Quantity)
        };

    /// <summary>
    /// The run's invoice blocks: one per invoice of a client whose row the office has confirmed, in
    /// the order those rows were confirmed.
    /// </summary>
    /// <remarks>
    /// One block per invoice rather than per paying client, because a client can genuinely hold
    /// several on one run — <c>AddShipmentInvoiceEndpoint</c> and <c>MoveInvoiceLineEndpoint</c>
    /// both open them through <see cref="ShipmentInvoiceReconciler.NextSequenceFor"/> — and merging
    /// them would discard a split the office deliberately made. The usual single invoice renders as
    /// one block either way. Two blocks of one client share its number and are told apart by their
    /// sequence, which is why the sequence still breaks the tie.
    ///
    /// An unconfirmed client contributes nothing: the number is what the file is read by, and a row
    /// nobody has finished has none.
    /// </remarks>
    private static List<ShipmentExportInvoice> BuildInvoices(
        InvoicedSplit split,
        Dictionary<long, PartyDelivery> deliveryByClient,
        Dictionary<(long ClientId, InvoiceLineSourceKind SourceKind, long SourceItemId), int> deliveredByClientItem) =>
        split.ByInvoiceAndOrderer
            .GroupBy(entry => entry.Key.InvoiceId)
            .Select(invoiceGroup => (InvoiceId: invoiceGroup.Key, Invoice: InvoiceOf(split, invoiceGroup.Key), Lines: invoiceGroup))
            .Where(x => split.ReadyNumberByPayer.ContainsKey(x.Invoice.PayerId))
            .OrderBy(x => split.ReadyNumberByPayer[x.Invoice.PayerId])
            .ThenBy(x => x.Invoice.Sequence)
            .Select(x => BuildExportInvoice(
                split,
                x.InvoiceId,
                split.ReadyNumberByPayer[x.Invoice.PayerId],
                x.Invoice,
                x.Lines,
                deliveryByClient,
                deliveredByClientItem))
            .ToList();

    private static ShipmentExportInvoice BuildExportInvoice(
        InvoicedSplit split,
        Guid invoiceId,
        int number,
        (long PayerId, Guid PayerPublicId, int Sequence, string Name, string? BusinessName) invoice,
        IEnumerable<KeyValuePair<(Guid InvoiceId, long OrdererId, InvoiceLineSourceKind SourceKind, long SourceItemId), InvoicedItem>> lines,
        Dictionary<long, PartyDelivery> deliveryByClient,
        Dictionary<(long ClientId, InvoiceLineSourceKind SourceKind, long SourceItemId), int> deliveredByClientItem) =>
        new()
        {
            Number = number,
            PayingClientName = invoice.Name,
            PayingClientBusinessName = invoice.BusinessName,
            PayingClientId = invoice.PayerPublicId,
            Sequence = invoice.Sequence,
            BillingRecipients = split.RecipientsByInvoice.GetValueOrDefault(invoiceId, []),
            Parties = lines
                .GroupBy(entry => entry.Key.OrdererId)
                // The payer's own goods lead; the rest follow by name.
                .OrderByDescending(g => g.Key == invoice.PayerId)
                .ThenBy(g => split.OrdererNames.GetValueOrDefault(g.Key, Missing), StringComparer.CurrentCulture)
                .Select(ordererGroup => BuildParty(
                    split,
                    invoice.PayerId,
                    ordererGroup,
                    deliveryByClient.GetValueOrDefault(ordererGroup.Key),
                    deliveredByClientItem))
                .ToList()
        };

    /// <summary>
    /// One party of a block: whose goods these are, where they went, and what the order said.
    /// </summary>
    /// <remarks>
    /// A null <paramref name="delivery"/> is a party with no stop on this run — a client whose
    /// pieces were moved onto this invoice while its own delivery went out on another. It gets no
    /// address, no notes and no vratky, because it has none here.
    /// </remarks>
    private static ShipmentExportInvoiceParty BuildParty(
        InvoicedSplit split,
        long payerId,
        IGrouping<long, KeyValuePair<(Guid InvoiceId, long OrdererId, InvoiceLineSourceKind SourceKind, long SourceItemId), InvoicedItem>> ordererGroup,
        PartyDelivery? delivery,
        Dictionary<(long ClientId, InvoiceLineSourceKind SourceKind, long SourceItemId), int> deliveredByClientItem) =>
        new()
        {
            ClientName = split.OrdererNames.GetValueOrDefault(ordererGroup.Key, Missing),
            IsPayer = ordererGroup.Key == payerId,
            Street = delivery?.Street,
            CityLine = delivery?.CityLine,
            DeliveryPlaceName = delivery?.DeliveryPlaceName,
            Notes = delivery?.Notes ?? [],
            Returns = delivery?.Returns ?? [],
            Products = ordererGroup
                .Select(entry => new ShipmentExportProduct
                {
                    Name = entry.Value.Name,
                    Kind = entry.Value.Kind,
                    PackageSize = entry.Value.PackageSize,
                    Quantity = entry.Value.Quantity,
                    DeliveredQuantity = DeliveredFor(deliveredByClientItem, ordererGroup.Key, entry.Key)
                })
                .OrderBy(p => p.Name, StringComparer.CurrentCulture)
                .ToList()
        };

    /// <summary>
    /// Pieces of one billed row the van actually drops at the client that ordered them, or null when
    /// no stop can answer for it.
    /// </summary>
    /// <remarks>
    /// A supplier good is bought at the supplier and never sits on a delivery table, so its
    /// delivered count is unknown rather than zero — the writers print a dash for it. An order item
    /// or a custom extra with no matching delivery genuinely is zero: this run bills for it and
    /// hands it over somewhere else, or on another run entirely.
    /// </remarks>
    private static int? DeliveredFor(
        Dictionary<(long ClientId, InvoiceLineSourceKind SourceKind, long SourceItemId), int> delivered,
        long ordererId,
        (Guid InvoiceId, long OrdererId, InvoiceLineSourceKind SourceKind, long SourceItemId) line) =>
        line.SourceKind == InvoiceLineSourceKind.SupplierGoodItem
            ? null
            : delivered.GetValueOrDefault((ordererId, line.SourceKind, line.SourceItemId));

    /// <summary>
    /// Where one client's goods went on this run, as its invoice parties report it.
    /// </summary>
    private static PartyDelivery ToDelivery(RawStop stop)
    {
        var (street, cityLine, _) = ResolveAddress(stop);

        return new PartyDelivery
        {
            Street = street,
            CityLine = cityLine,
            // Only when the stop actually delivers there — a stop pointed back at the client's own
            // address still carries the place it once chose, and naming it would claim a
            // destination the van is not going to.
            DeliveryPlaceName = stop.SelectedAddressKind == DeliveryAddressKind.DeliveryPlace
                ? stop.DeliveryPlaceName
                : null,
            Notes = stop.Notes,
            Returns = stop.Returns
        };
    }

    /// <summary>
    /// Who one invoice bills, its sequence and its name, falling back to a placeholder for an
    /// invoice the graph did not hand back — a block must still name somebody.
    /// </summary>
    private static (long PayerId, Guid PayerPublicId, int Sequence, string Name, string? BusinessName)
        InvoiceOf(InvoicedSplit split, Guid invoiceId) =>
        split.Invoices.TryGetValue(invoiceId, out var found)
            ? found
            : (PayerId: 0, PayerPublicId: Guid.Empty, Sequence: 1, Name: Missing, BusinessName: null);

    private static ShipmentExportStop ToStop(
        RawStop stop,
        CompanyOptions company,
        List<ShipmentExportProduct> stockPurchases)
    {
        if (stop.Kind == OutgoingShipmentStopKind.Company)
            return ToWarehouseStop(stop, company, stockPurchases);

        var (_, _, city) = ResolveAddress(stop);

        return new ShipmentExportStop
        {
            Order = stop.Order,
            ClientName = stop.ClientName,
            Label = stop.Label,
            City = city,
            Products = BuildProducts(stop)
        };
    }

    /// <summary>
    /// The call at our own warehouse: the goods bought for stock come off here.
    /// </summary>
    /// <remarks>
    /// Its town is configuration rather than a row — the stop carries a label and coordinates and
    /// nothing else — so it comes from <see cref="CompanyOptions"/> the same way the route's start
    /// point does. Without it the overview listed the stop with no town and no piece count, and the
    /// goods it exists to unload appeared nowhere but a block at the foot of the overview.
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
            City = company.City,
            Products = stockPurchases
        };

    /// <summary>
    /// The stop's product table: what the van drops there, custom extras last.
    /// </summary>
    /// <remarks>
    /// Delivered pieces only. The stop used to carry a billed count beside each one, for the
    /// per-stop sheets that no longer exist — the office reads what is billed off the invoice part
    /// now, where the pieces are grouped by the invoice that bills them rather than by the van's
    /// route. What is left here feeds the overview's route table and the run's totals.
    /// </remarks>
    private static List<ShipmentExportProduct> BuildProducts(RawStop stop) =>
        stop.Products
            .Concat(stop.CustomExtras)
            .Select(product => new ShipmentExportProduct
            {
                Name = product.Name,
                Kind = product.Kind,
                PackageSize = product.PackageSize,
                Weight = product.Weight,
                Quantity = product.Quantity
            })
            .ToList();

    /// <summary>
    /// Picks the address this stop actually delivers to and splits it into the sheet's lines.
    /// </summary>
    /// <remarks>
    /// Same rule as <c>resolveDetailStopAddress</c> / <c>resolveFromAddresses</c> on the client:
    /// the chosen delivery place wins, and the two client addresses stand in for each other in
    /// either direction — a Contact kind falls back to Official as it always has, and an
    /// Official kind now falls through to Contact, because a client invoiced through a payer has
    /// no official address at all.
    /// </remarks>
    private static (string? Street, string? CityLine, string? City) ResolveAddress(RawStop stop)
    {
        if (stop.SelectedAddressKind == DeliveryAddressKind.DeliveryPlace && stop.DeliveryPlaceAddress is not null)
            return SplitAddress(stop.DeliveryPlaceAddress);

        var address = stop.SelectedAddressKind == DeliveryAddressKind.Contact
            ? stop.ContactAddress ?? stop.OfficialAddress
            : stop.OfficialAddress ?? stop.ContactAddress;

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
    /// One delivered row, carrying the identity an invoice line refers to it by — which is how a
    /// billed row finds what the van actually drops for it.
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

    /// <summary>
    /// One stored invoice line with both clients it concerns resolved: who is billed, and whose
    /// goods those pieces are.
    /// </summary>
    private sealed record BilledLine(
        long PayerId,
        Guid InvoiceId,
        long OrdererId,
        string OrdererName,
        InvoiceLineSourceKind SourceKind,
        long SourceItemId,
        OutgoingShipmentInvoiceLine Line);

    /// <summary>
    /// What one invoice is, apart from its lines: who pays, which of that payer's invoices it is,
    /// and where it is addressed.
    /// </summary>
    private sealed record InvoiceFacts
    {
        public required long PayerId { get; init; }
        public required Guid PayerPublicId { get; init; }
        public required int Sequence { get; init; }
        public required string Name { get; init; }
        public string? BusinessName { get; init; }
        public string? Street { get; init; }
        public string? CityLine { get; init; }
    }

    /// <summary>
    /// Where one client's goods went on this run — the delivery its invoice parties report.
    /// </summary>
    private sealed record PartyDelivery
    {
        public string? Street { get; init; }
        public string? CityLine { get; init; }
        public string? DeliveryPlaceName { get; init; }
        public List<string> Notes { get; init; } = [];
        public List<ShipmentExportReturn> Returns { get; init; } = [];
    }

    /// <summary>
    /// The reconciled split, in the shapes the export reads it in.
    /// </summary>
    private sealed record InvoicedSplit
    {
        /// <summary>
        /// Confirmation number of each client whose row is currently marked finished. Absence is
        /// what keeps an invoice out of the file.
        /// </summary>
        public required Dictionary<long, int> ReadyNumberByPayer { get; init; }

        /// <summary>Billed pieces keyed by (invoice, orderer, item) — what a party row reports.</summary>
        public required Dictionary<(Guid InvoiceId, long OrdererId, InvoiceLineSourceKind SourceKind, long SourceItemId), InvoicedItem> ByInvoiceAndOrderer { get; init; }

        /// <summary>Who each invoice bills, its sequence and its names, by public ID.</summary>
        public required Dictionary<Guid, (long PayerId, Guid PayerPublicId, int Sequence, string Name, string? BusinessName)> Invoices { get; init; }

        /// <summary>Name of each client that ordered billed pieces.</summary>
        public required Dictionary<long, string> OrdererNames { get; init; }

        /// <summary>Billing recipients named on each invoice, by the invoice's public ID.</summary>
        public required Dictionary<Guid, List<ShipmentExportBillingRecipient>> RecipientsByInvoice { get; init; }

        public static InvoicedSplit Empty => new()
        {
            ReadyNumberByPayer = [], ByInvoiceAndOrderer = [], Invoices = [], OrdererNames = [],
            RecipientsByInvoice = []
        };
    }
}
