using System.Globalization;
using AleTrack.Common.Enums;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Czech text shared by the shipment export writers.
/// </summary>
/// <remarks>
/// The only Czech user-facing strings in the backend. They live here rather than in either writer so
/// the workbook and the document cannot drift into calling the same thing by two names.
///
/// The kind names mirror <c>L.kind</c> in <c>app/src/lib/labels.ts</c> — unavoidable duplication,
/// because these files are written on the server rather than rendered by the client.
/// </remarks>
public static class ShipmentExportLabels
{
    /// <summary>
    /// Placeholder for a value the shipment does not have, matching the dash the app renders.
    /// </summary>
    public const string Missing = "—";

    /// <summary>Heading of the invoice part, in both writers.</summary>
    public const string Invoicing = "Fakturace";

    /// <summary>Label naming the client a stop's goods are billed to.</summary>
    public const string InvoicedTo = "Fakturováno na";

    /// <summary>
    /// Heading for one invoice block — <c>1. Luděk Pachl – Pachl s.r.o.</c>: the number the office
    /// confirmed the row under, the client, and its trading name when it has one. Suffixed with the
    /// invoice's sequence only when the paying client holds more than one on the run, so a single
    /// invoice is not saddled with a meaningless "1".
    /// </summary>
    /// <remarks>
    /// Shared by both export writers so they cannot drift into disagreeing about which headings
    /// need the suffix. Keyed on <see cref="ShipmentExportInvoice.PayingClientId"/> rather than
    /// the name, because two distinct clients can genuinely share a name — which is also why the
    /// trading name is printed beside it — but IDs don't.
    ///
    /// The number leads because it is what the office writes onto the paper invoice and reads the
    /// file by. Two blocks of one client share it, which is exactly why the sequence is still what
    /// tells them apart.
    /// </remarks>
    public static string InvoiceHeading(ShipmentExportInvoice invoice, IReadOnlyDictionary<Guid, int> invoiceCountByPayer)
    {
        var client = string.IsNullOrWhiteSpace(invoice.PayingClientBusinessName)
            ? invoice.PayingClientName
            : $"{invoice.PayingClientName} – {invoice.PayingClientBusinessName}";

        return invoiceCountByPayer[invoice.PayingClientId] > 1
            ? $"{invoice.Number}. {client} · Faktura {invoice.Sequence}"
            : $"{invoice.Number}. {client}";
    }

    /// <summary>How many invoices each paying client holds on the run, for <see cref="InvoiceHeading"/>.</summary>
    public static Dictionary<Guid, int> InvoiceCountByPayer(IEnumerable<ShipmentExportInvoice> invoices) =>
        invoices.GroupBy(i => i.PayingClientId).ToDictionary(g => g.Key, g => g.Count());

    /// <summary>
    /// Heading for one invoice party's block — whose goods the table below lists.
    /// </summary>
    /// <remarks>
    /// The client's name and nothing else. It used to gloss the payer's own row as "vlastní zboží",
    /// which read as jargon on the one invoice that needs no distinction at all: a block with a
    /// single party. The writers now leave the heading out there entirely, so where it does appear
    /// the names are the whole point.
    /// </remarks>
    public static string PartyHeading(ShipmentExportInvoiceParty party) => party.ClientName;

    /// <summary>
    /// Heading of an invoice's billing-recipients section, naming the payer the office chose these
    /// addresses for.
    /// </summary>
    /// <remarks>
    /// Shared by both writers for the same reason <see cref="InvoiceHeading"/> and
    /// <see cref="PartyHeading"/> are: the exact wording must not drift between them.
    /// </remarks>
    public static string BillingRecipientsHeading(ShipmentExportInvoice invoice) =>
        $"Fakturační adresa pro {invoice.PayingClientName}";

    /// <summary>Heading of a party's list of deviations, in both writers.</summary>
    public const string Deviations = "Odchylky";

    private static readonly Dictionary<ClientLedgerEntryTarget, string> TargetLabels = new()
    {
        [ClientLedgerEntryTarget.ProductQuantity] = "Produkt",
        [ClientLedgerEntryTarget.SupplierGoodQuantity] = "Zboží od dodavatele",
        [ClientLedgerEntryTarget.CustomExtraQuantity] = "Položka navíc",
        [ClientLedgerEntryTarget.ReturnQuantity] = "Vratka",
        [ClientLedgerEntryTarget.DeliveryAddress] = "Místo dodání",
        [ClientLedgerEntryTarget.Money] = "Peníze",
        [ClientLedgerEntryTarget.Other] = "Jiné"
    };

    /// <summary>
    /// What one deviation is about: the line it names, or what kind of thing it is when it names
    /// none.
    /// </summary>
    /// <remarks>
    /// The line name wins because it is the more specific of the two, and it is what the reader is
    /// scanning for — "Pilsner Urquell" locates the correction, "Produkt" does not.
    /// </remarks>
    public static string DeviationSubject(ShipmentExportDeviation deviation) =>
        string.IsNullOrWhiteSpace(deviation.LineName)
            ? TargetLabels.GetValueOrDefault(deviation.Target, Missing)
            : deviation.LineName;

    /// <summary>
    /// What the plan said — a piece count, the address it was going to, or nothing to say.
    /// </summary>
    public static string DeviationPlanned(ShipmentExportDeviation deviation) =>
        deviation switch
        {
            { PlannedQuantity: { } quantity } => Pieces(quantity),
            { PlannedText: { } text } when text.Length > 0 => text,
            _ => Missing
        };

    /// <summary>
    /// What happened instead — pieces, the address it went to, or a debt named in the direction it
    /// runs.
    /// </summary>
    /// <remarks>
    /// The money case spells the direction out rather than printing a signed number. This is the one
    /// figure in the file somebody acts on, and a leading minus is too easy to read past.
    /// </remarks>
    public static string DeviationActual(ShipmentExportDeviation deviation) =>
        deviation switch
        {
            { ActualQuantity: { } quantity } => Pieces(quantity),
            { ActualText: { } text } when text.Length > 0 => text,
            { Amount: { } amount } => amount >= 0
                ? $"Klient dluží {Money(amount)}"
                : $"Dlužíme {Money(-amount)}",
            _ => Missing
        };

    /// <summary>
    /// The dispatcher's words, with the follow-up flag appended — a deviation somebody still has to
    /// settle must say so on the page, not only in the app.
    /// </summary>
    public static string DeviationNote(ShipmentExportDeviation deviation)
    {
        var parts = new[]
            {
                string.IsNullOrWhiteSpace(deviation.Note) ? null : deviation.Note,
                deviation.RequiresFollowUp ? "k vyřešení" : null
            }
            .Where(part => part is not null);

        var note = string.Join(" · ", parts);

        return note.Length > 0 ? note : Missing;
    }

    /// <summary>
    /// Money in whole crowns — <c>2 400 Kč</c>. The only currency this project bills in.
    /// </summary>
    public static string Money(decimal value) => $"{value.ToString("#,##0", Culture)} Kč";

    private static readonly Dictionary<ProductKind, string> KindLabels = new()
    {
        [ProductKind.Keg] = "Sud",
        [ProductKind.Bottle] = "Basa",
        [ProductKind.Can] = "Plechovka",
        [ProductKind.Multipack] = "Multipack",
        [ProductKind.Other] = "Ostatní"
    };

    /// <summary>
    /// Czech name of a product kind, or <see cref="Missing"/> for an item with no product behind it.
    /// </summary>
    public static string KindLabel(ProductKind? kind) =>
        kind is not null && KindLabels.TryGetValue(kind.Value, out var label) ? label : Missing;

    /// <summary>
    /// The culture every number and date in these files is written in.
    /// </summary>
    /// <remarks>
    /// Pinned rather than left to the ambient culture. The document writer emits numbers as text, so
    /// without this a server running under an invariant or English culture writes "0.5 l" and
    /// "4133.4 kg" into a Czech document — and the output would differ between machines.
    ///
    /// The workbook writer needs none of this: it writes real numeric cells and lets the reader's own
    /// locale format them.
    /// </remarks>
    private static readonly CultureInfo Culture = CultureInfo.GetCultureInfo("cs-CZ");

    /// <summary>
    /// Whole number, thousands grouped — <c>4 133</c>.
    /// </summary>
    public static string Number(int value) => value.ToString("#,##0", Culture);

    /// <summary>
    /// A piece count with its unit — <c>20 ks</c>.
    /// </summary>
    public static string Pieces(int value) => $"{Number(value)} ks";

    /// <summary>
    /// Package size in litres — <c>0,5 l</c>, <c>30 l</c> — or <see cref="Missing"/> for an item with
    /// no product behind it.
    /// </summary>
    public static string Litres(double? value) =>
        value is null ? Missing : $"{value.Value.ToString("0.####", Culture)} l";

    /// <summary>
    /// Weight in kilograms to one decimal — <c>4 133,4 kg</c>.
    /// </summary>
    public static string Kilograms(double value) => $"{value.ToString("#,##0.#", Culture)} kg";

    /// <summary>
    /// Calendar date — <c>4.8.2026</c> — or <see cref="Missing"/> when the run has no date yet.
    /// </summary>
    public static string Date(DateTime? value) => value?.ToString("d.M.yyyy", Culture) ?? Missing;
}
