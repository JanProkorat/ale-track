using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Suppliers.Utils;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// What reconciliation had to change about an item that was <em>already</em> split across invoices.
/// </summary>
public enum InvoiceAdjustmentKind
{
    /// <summary>Pieces appeared and were added to the paying client's first invoice.</summary>
    QuantityAdded = 0,

    /// <summary>Pieces disappeared and were trimmed off the split.</summary>
    QuantityRemoved = 1,

    /// <summary>The source item left the shipment; its invoice lines were dropped.</summary>
    SourceRemoved = 2
}

/// <summary>
/// One change reconciliation made to an existing split, for reporting back to the user.
/// </summary>
public sealed record InvoiceAdjustment
{
    /// <summary>What kind of change this was.</summary>
    public InvoiceAdjustmentKind Kind { get; init; }

    /// <summary>Which kind of shipment item it concerned.</summary>
    public InvoiceLineSourceKind SourceKind { get; init; }

    /// <summary>
    /// Display name of the affected item, when the graph had enough loaded to resolve it.
    /// </summary>
    public string? ItemName { get; init; }

    /// <summary>Number of pieces added, removed, or dropped.</summary>
    public int Quantity { get; init; }
}

/// <summary>
/// Outcome of a reconciliation pass.
/// </summary>
public sealed record ReconcileResult
{
    /// <summary>
    /// Changes made to already-split items. Empty when the pass only materialised a default
    /// split — that is not a change the user needs to be told about.
    /// </summary>
    public IReadOnlyList<InvoiceAdjustment> Adjustments { get; init; } = [];

    /// <summary>Invoices detached from the shipment; the caller deletes them.</summary>
    public IReadOnlyList<OutgoingShipmentInvoice> RemovedInvoices { get; init; } = [];

    /// <summary>Lines detached from their invoice; the caller deletes them.</summary>
    public IReadOnlyList<OutgoingShipmentInvoiceLine> RemovedLines { get; init; } = [];
}

/// <summary>
/// Keeps a shipment's invoice split consistent with what the shipment actually carries.
/// </summary>
/// <remarks>
/// This is the only place that changes the split implicitly, so it is also the only place
/// where drift bugs can live. Deliberately free of <c>DbContext</c>: it mutates a loaded
/// entity graph and reports what the caller must delete, which keeps it unit-testable
/// without a database.
///
/// Sources must be persisted — lines are matched to source items by foreign key, so an
/// item with <c>Id == 0</c> cannot be told apart from any other unsaved item.
/// </remarks>
public static class ShipmentInvoiceReconciler
{
    /// <summary>
    /// A billable item of the shipment, flattened to what reconciliation needs.
    /// </summary>
    private sealed record BillableSource
    {
        public required InvoiceLineSourceKind Kind { get; init; }
        public required long ItemId { get; init; }
        public required long OrderingClientId { get; init; }

        /// <summary>
        /// Client the invoice is issued to: the ordering client's payer when it has one,
        /// otherwise the ordering client itself.
        /// </summary>
        public required long PayingClientId { get; init; }

        public required int Quantity { get; init; }

        /// <summary>
        /// What a line billing this source records: its name and, for an order item, the product
        /// facts and applied prices.
        /// </summary>
        /// <remarks>
        /// Resolved once in <see cref="CollectSources"/> rather than at line-build time, because
        /// the correct source depends on the run's state — the live product while it is
        /// <see cref="OutgoingShipmentState.Created"/>, the run's own stop item from
        /// <see cref="OutgoingShipmentState.Loaded"/> onward — and that is the only place with
        /// both in scope.
        /// </remarks>
        public LineSnapshot Snapshot { get; init; } = LineSnapshot.Empty;

        /// <summary>
        /// The ordering client entity, when the graph had it loaded. Carried so a freshly created
        /// invoice gets its navigation filled — the response is mapped from the same in-memory
        /// graph, and a null navigation would surface as a blank client name.
        /// </summary>
        public Client? OrderingClient { get; init; }

        /// <summary>
        /// The paying client entity when the graph had it loaded. Carried for the same reason
        /// as <see cref="OrderingClient"/>: a created invoice with a null navigation surfaces
        /// as a blank client name.
        /// </summary>
        public Client? PayingClient { get; init; }

        public (InvoiceLineSourceKind, long) Key => (Kind, ItemId);
    }

    /// <summary>
    /// The product facts an invoice line records about what it bills.
    /// </summary>
    private sealed record LineSnapshot(
        string ProductName,
        ProductKind? Kind,
        double? PackageSize,
        decimal? UnitPriceWithVat,
        decimal? UnitPriceWithoutVat)
    {
        public static readonly LineSnapshot Empty = new(string.Empty, null, null, null, null);
    }

    /// <summary>
    /// Brings a shipment's invoices in line with its items.
    /// </summary>
    /// <remarks>
    /// Guarantees on return:
    /// <list type="number">
    /// <item>every client with billable items has at least one invoice,</item>
    /// <item>every line points at an item the shipment still carries,</item>
    /// <item>for every billable item, the quantities of its invoice lines <em>and</em> its
    /// private lines sum to the item's quantity.</item>
    /// </list>
    /// </remarks>
    /// <param name="split">
    /// Shipment with stops (incl. orders and their items), extra items and invoices (incl.
    /// lines) loaded, together with its private lines.
    /// </param>
    public static ReconcileResult Reconcile(ShipmentInvoiceSplit split)
    {
        ArgumentNullException.ThrowIfNull(split);

        var shipment = split.Shipment;
        var privateLines = split.PrivateLines;

        var adjustments = new List<InvoiceAdjustment>();
        var removedInvoices = new List<OutgoingShipmentInvoice>();
        var removedLines = new List<OutgoingShipmentInvoiceLine>();

        var sources = CollectSources(shipment);
        var sourceKeys = sources.Select(s => s.Key).ToHashSet();
        var billableClientIds = sources.Select(s => s.PayingClientId).Distinct().ToList();

        // 1. Every client who is billed gets an invoice to be billed on. A split made before the
        //    payer relation existed counts as one: the orderer's own invoice is a home too, so
        //    setting a payer does not open an empty second invoice beside it. Only pieces that
        //    still need a home from here on follow the payer.
        foreach (var group in sources.GroupBy(s => s.PayingClientId))
        {
            var homes = group.Select(s => s.OrderingClientId).Append(group.Key).ToHashSet();
            if (shipment.Invoices.All(i => !homes.Contains(i.ClientId)))
                shipment.Invoices.Add(BuildInvoice(shipment, group.Key,
                    group.Select(s => s.PayingClient).FirstOrDefault(c => c is not null), sequence: 1));
        }

        // 2. Lines whose source item is no longer on the shipment — private ones included: the
        //    pieces are gone, so there is nothing left to keep off an invoice.
        foreach (var invoice in shipment.Invoices.ToList())
        {
            foreach (var line in invoice.Lines.ToList())
            {
                if (sourceKeys.Contains(KeyOf(line)))
                    continue;

                adjustments.Add(SourceRemoved(line));
                invoice.Lines.Remove(line);
                removedLines.Add(line);
            }
        }

        foreach (var line in privateLines.ToList())
        {
            if (sourceKeys.Contains(KeyOf(line)))
                continue;

            adjustments.Add(SourceRemoved(line));
            privateLines.Remove(line);
            removedLines.Add(line);
        }

        // 3. Invoices with no reason left to exist. An invoice of a client who no longer
        //    orders anything is kept while it still holds cross-billed lines — that is a
        //    deliberate decision by the user, not leftover state.
        foreach (var invoice in shipment.Invoices.ToList())
        {
            if (billableClientIds.Contains(invoice.ClientId) || invoice.Lines.Count > 0)
                continue;

            shipment.Invoices.Remove(invoice);
            removedInvoices.Add(invoice);
        }

        // 4. Cover every source item exactly once, counting private pieces as covered — they are
        //    accounted for, just not billed.
        foreach (var source in sources)
        {
            var placements = shipment.Invoices
                .SelectMany(i => i.Lines.Select(l => (Invoice: (OutgoingShipmentInvoice?)i, Line: l)))
                .Concat(privateLines.Select(l => (Invoice: (OutgoingShipmentInvoice?)null, Line: l)))
                .Where(x => KeyOf(x.Line) == source.Key)
                .ToList();

            // A planned run's invoices should follow a price or name correction; an issued one must
            // not. The boundary is the same one that freezes the shipment's content.
            if (ShipmentMutability.IsContentEditable(shipment.State))
                foreach (var placement in placements)
                    Refresh(placement.Line, source.Snapshot);

            var assigned = placements.Sum(x => x.Line.Quantity);
            var diff = source.Quantity - assigned;

            switch (diff)
            {
                case > 0:
                {
                    // assigned == 0 means this item had no split yet, so this is the default
                    // split being materialised — not drift, and not worth reporting.
                    if (assigned > 0)
                        adjustments.Add(Adjustment(InvoiceAdjustmentKind.QuantityAdded, source, diff));

                    // Surplus is always billed. Pieces become private only when the user says so.
                    var home = HomeInvoiceFor(shipment, source);
                    var existing = home.Lines.FirstOrDefault(l => KeyOf(l) == source.Key);
                    if (existing is not null)
                        existing.Quantity += diff;
                    else
                        home.Lines.Add(BuildLine(shipment, source, diff));
                    break;
                }
                case < 0:
                {
                    var over = -diff;
                    adjustments.Add(Adjustment(InvoiceAdjustmentKind.QuantityRemoved, source, over));

                    // Private pieces go first, then other clients' invoices, then the paying
                    // client's extra invoices, and their first invoice last. Taking from the owner
                    // first would make the product vanish from the invoice of whoever ordered it
                    // and survive only on someone else's — worse than losing the exception. Losing
                    // the private mark is the mildest failure of the three: it is visible on the
                    // invoice and reported in the banner, whereas silently un-billing pieces would
                    // cost money nobody notices.
                    var order = placements
                        .OrderBy(x => TrimRank(x.Invoice, source))
                        .ThenByDescending(x => x.Invoice?.Sequence ?? 0);

                    foreach (var placement in order)
                    {
                        if (over == 0)
                            break;

                        var take = Math.Min(over, placement.Line.Quantity);
                        placement.Line.Quantity -= take;
                        over -= take;
                    }

                    break;
                }
            }
        }

        // 5. Lines trimmed to nothing.
        foreach (var invoice in shipment.Invoices)
        {
            foreach (var line in invoice.Lines.Where(l => l.Quantity <= 0).ToList())
            {
                invoice.Lines.Remove(line);
                removedLines.Add(line);
            }
        }

        foreach (var line in privateLines.Where(l => l.Quantity <= 0).ToList())
        {
            privateLines.Remove(line);
            removedLines.Add(line);
        }

        return new ReconcileResult
        {
            Adjustments = adjustments,
            RemovedInvoices = removedInvoices,
            RemovedLines = removedLines
        };
    }

    /// <summary>
    /// Flattens everything the shipment bills for: order items of its order stops, plus the
    /// client and custom extra items that have a client recorded.
    /// </summary>
    /// <remarks>
    /// Inventory extra items are absent by design — they return to our own stock.
    /// Extra items without a <c>ClientId</c> are skipped rather than guessed at; they predate
    /// invoicing and there is nobody to bill them to.
    /// </remarks>
    private static List<BillableSource> CollectSources(OutgoingShipment shipment)
    {
        var sources = new List<BillableSource>();

        foreach (var stop in shipment.Stops.Where(s => s.ClientOrder is not null).OrderBy(s => s.Order))
        {
            foreach (var item in stop.ClientOrder!.OrderItems)
            {
                var payer = PayerOf(stop.ClientOrder.ClientId, stop.ClientOrder.Client);
                sources.Add(new BillableSource
                {
                    Kind = InvoiceLineSourceKind.OrderItem,
                    ItemId = RequirePersisted(item.Id, nameof(OrderItem)),
                    OrderingClientId = stop.ClientOrder.ClientId,
                    OrderingClient = stop.ClientOrder.Client,
                    PayingClientId = payer.Id,
                    PayingClient = payer.Entity,
                    Quantity = item.Quantity,
                    Snapshot = SnapshotFor(shipment, stop, item)
                });
            }
        }

        // The client ordered these off a supplier's price list, so they are billed like the beer
        // beside them. The garage/supplier split is sourcing, not content — the full quantity is
        // billed either way, exactly as an order item's pieces are whether or not they came off
        // our own shelf.
        foreach (var (item, order) in ShipmentInvoiceGraph.SupplierGoodsOf(shipment))
        {
            var payer = PayerOf(order.ClientId, order.Client);
            sources.Add(new BillableSource
            {
                Kind = InvoiceLineSourceKind.SupplierGoodItem,
                ItemId = RequirePersisted(item.Id, nameof(OrderSupplierGoodItem)),
                OrderingClientId = order.ClientId,
                OrderingClient = order.Client,
                PayingClientId = payer.Id,
                PayingClient = payer.Entity,
                Quantity = item.Quantity,
                Snapshot = SupplierGoodSnapshot(item)
            });
        }

        // Inventory sourcing is not a billable source: those pieces are already covered
        // by the order item they fulfil, so billing them again would double-charge.
        foreach (var (item, order) in ShipmentInvoiceGraph.CustomExtrasOf(shipment))
        {
            var payer = PayerOf(order.ClientId, order.Client);
            sources.Add(new BillableSource
            {
                Kind = InvoiceLineSourceKind.CustomExtraItem,
                ItemId = RequirePersisted(item.Id, nameof(OrderCustomExtraItem)),
                OrderingClientId = order.ClientId,
                OrderingClient = order.Client,
                PayingClientId = payer.Id,
                PayingClient = payer.Entity,
                Quantity = item.Quantity,
                // A custom extra has no product, so it carries a description and no prices —
                // which is what the invoice already showed for these lines.
                Snapshot = new LineSnapshot(Truncate(item.Description), null, null, null, null)
            });
        }

        return sources;
    }

    /// <summary>
    /// Who is billed for an ordering client's pieces. Falls back to the ordering client when the
    /// graph has no <c>Client</c> navigation loaded — the relation is unknowable then, and billing
    /// the orderer is what happened before the relation existed.
    /// </summary>
    private static (long Id, Client? Entity) PayerOf(long orderingClientId, Client? orderingClient) =>
        orderingClient?.InvoicingClientId is { } payerId
            ? (payerId, orderingClient.InvoicingClient)
            : (orderingClientId, orderingClient);

    /// <summary>
    /// What a supplier-good line records: the good's name with its size, and the price the order
    /// line is quoted at.
    /// </summary>
    /// <remarks>
    /// The price comes from <see cref="SupplierGoodPricing.Primary"/>, so the invoice charges the
    /// number the order already showed for that line. Frozen onto the line like every other, which
    /// is what keeps an issued invoice from following a later change to the supplier's price list.
    ///
    /// The size joins the name because it is what tells two lines apart: a 10 kg and a 2 kg CO₂
    /// bottle are separate goods with the same name, and <see cref="LineSnapshot.PackageSize"/>
    /// cannot hold '10 kg' — it is a volume in litres.
    /// </remarks>
    private static LineSnapshot SupplierGoodSnapshot(OrderSupplierGoodItem item)
    {
        var good = item.SupplierGood;
        var name = good is null
            ? string.Empty
            : string.IsNullOrWhiteSpace(good.Size) ? good.Name : $"{good.Name} {good.Size}";

        var price = SupplierGoodPricing.Primary(good?.Prices);

        return new LineSnapshot(Truncate(name), null, null, price?.PriceWithVat, price?.PriceWithoutVat);
    }

    /// <summary>
    /// Where an order line's recorded facts come from, which depends on the run's state.
    /// </summary>
    /// <remarks>
    /// While the run is still being planned the live product <em>is</em> the current truth, and no
    /// stop items exist yet. From <see cref="OutgoingShipmentState.Loaded"/> onward the run's own
    /// snapshot is what a line must agree with — the product may have moved on since, and an
    /// invoice must not follow it.
    /// </remarks>
    private static LineSnapshot SnapshotFor(OutgoingShipment shipment, OutgoingShipmentStop stop, OrderItem item)
    {
        if (!ShipmentMutability.IsContentEditable(shipment.State))
        {
            var stopItem = stop.Items.FirstOrDefault(si => si.OrderItemId == item.Id);
            if (stopItem is not null)
                return new LineSnapshot(
                    Truncate(stopItem.ProductName),
                    stopItem.Kind,
                    stopItem.PackageSize,
                    stopItem.UnitPriceWithVat,
                    stopItem.UnitPriceWithoutVat);
        }

        return new LineSnapshot(
            Truncate(item.Product?.Name),
            item.Product?.Kind,
            item.Product?.PackageSize,
            item.Product?.PriceWithVat,
            item.Product?.PriceWithoutVat);
    }

    /// <summary>
    /// Fits a name into the snapshot column. A custom extra's description may run to 200
    /// characters where the column holds 100; truncating beats failing the save.
    /// </summary>
    private static string Truncate(string? name) =>
        name is null ? string.Empty : name.Length <= 100 ? name : name[..100];

    /// <summary>
    /// Brings an existing line's recorded facts back in step with its source. Only ever called
    /// while the run is still editable — an issued invoice must not follow a price correction.
    /// </summary>
    private static void Refresh(OutgoingShipmentInvoiceLine line, LineSnapshot snapshot)
    {
        line.ProductName = snapshot.ProductName;
        line.Kind = snapshot.Kind;
        line.PackageSize = snapshot.PackageSize;
        line.UnitPriceWithVat = snapshot.UnitPriceWithVat;
        line.UnitPriceWithoutVat = snapshot.UnitPriceWithoutVat;
    }

    /// <summary>
    /// The invoice a source's pieces default onto — the paying client's lowest-sequence one.
    /// </summary>
    private static OutgoingShipmentInvoice HomeInvoiceFor(OutgoingShipment shipment, BillableSource source)
    {
        var home = shipment.Invoices
            .Where(i => i.ClientId == source.PayingClientId)
            .OrderBy(i => i.Sequence)
            .FirstOrDefault();

        if (home is not null)
            return home;

        home = BuildInvoice(shipment, source.PayingClientId, source.PayingClient,
            sequence: NextSequenceFor(shipment, source.PayingClientId));
        shipment.Invoices.Add(home);
        return home;
    }

    /// <summary>
    /// Next free sequence number for a client's invoices within the shipment.
    /// </summary>
    public static int NextSequenceFor(OutgoingShipment shipment, long clientId)
    {
        var used = shipment.Invoices.Where(i => i.ClientId == clientId).Select(i => i.Sequence).ToList();
        return used.Count == 0 ? 1 : used.Max() + 1;
    }

    private static OutgoingShipmentInvoice BuildInvoice(OutgoingShipment shipment, long clientId, Client? client, int sequence) =>
        new()
        {
            PublicId = Guid.NewGuid(),
            OutgoingShipment = shipment,
            ClientId = clientId,
            Client = client!,
            Sequence = sequence
        };

    /// <summary>
    /// Where a placement sits in the trim order: private pieces first, then invoices that are not
    /// the source's own home, then its home.
    /// </summary>
    /// <remarks>
    /// Compares against the <em>paying</em> client, not the ordering one. A sub-client's home
    /// invoice belongs to its payer, so an orderer comparison would rank that home as "somebody
    /// else's" and empty the very line that should survive a drop.
    /// </remarks>
    private static int TrimRank(OutgoingShipmentInvoice? invoice, BillableSource source) =>
        invoice is null ? 0
        : invoice.ClientId != source.PayingClientId ? 1
        : 2;

    private static InvoiceAdjustment SourceRemoved(OutgoingShipmentInvoiceLine line) =>
        new()
        {
            Kind = InvoiceAdjustmentKind.SourceRemoved,
            SourceKind = line.SourceKind,
            ItemName = NameOf(line),
            Quantity = line.Quantity
        };

    private static OutgoingShipmentInvoiceLine BuildLine(OutgoingShipment shipment, BillableSource source, int quantity)
    {
        var line = new OutgoingShipmentInvoiceLine
        {
            PublicId = Guid.NewGuid(),
            OutgoingShipmentId = shipment.Id,
            SourceKind = source.Kind,
            Quantity = quantity,
            ProductName = source.Snapshot.ProductName,
            Kind = source.Snapshot.Kind,
            PackageSize = source.Snapshot.PackageSize,
            UnitPriceWithVat = source.Snapshot.UnitPriceWithVat,
            UnitPriceWithoutVat = source.Snapshot.UnitPriceWithoutVat
        };

        switch (source.Kind)
        {
            case InvoiceLineSourceKind.OrderItem:
                line.OrderItemId = source.ItemId;
                break;
            case InvoiceLineSourceKind.CustomExtraItem:
                line.CustomExtraItemId = source.ItemId;
                break;
            case InvoiceLineSourceKind.SupplierGoodItem:
                line.SupplierGoodItemId = source.ItemId;
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(source), source.Kind, "Unknown invoice line source kind.");
        }

        return line;
    }

    /// <summary>
    /// Identity of the item a line bills for.
    /// </summary>
    private static (InvoiceLineSourceKind, long) KeyOf(OutgoingShipmentInvoiceLine line) =>
        (line.SourceKind, line.SourceKind switch
        {
            InvoiceLineSourceKind.OrderItem => line.OrderItemId ?? 0,
            InvoiceLineSourceKind.CustomExtraItem => line.CustomExtraItemId ?? 0,
            InvoiceLineSourceKind.SupplierGoodItem => line.SupplierGoodItemId ?? 0,
            _ => 0
        });

    /// <summary>
    /// Display name for a line whose source has already left the shipment.
    /// </summary>
    /// <remarks>
    /// Reads the line's own recorded name, which is exactly the case it exists for: the source is
    /// gone, so reaching through to <c>OrderItem.Product</c> was best-effort and returned null as
    /// often as not.
    /// </remarks>
    private static string? NameOf(OutgoingShipmentInvoiceLine line) =>
        string.IsNullOrEmpty(line.ProductName) ? null : line.ProductName;

    private static InvoiceAdjustment Adjustment(InvoiceAdjustmentKind kind, BillableSource source, int quantity) =>
        new()
        {
            Kind = kind,
            SourceKind = source.Kind,
            ItemName = source.Snapshot.ProductName,
            Quantity = quantity
        };

    /// <summary>
    /// Lines are matched to sources by foreign key, so an unsaved item cannot be told apart
    /// from any other unsaved item. Failing loudly beats silently merging two items' splits.
    /// </summary>
    private static long RequirePersisted(long id, string entityName) =>
        id == 0
            ? throw new InvalidOperationException(
                $"{entityName} must be persisted before its invoice split can be reconciled.")
            : id;
}
