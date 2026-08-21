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
    /// Heading for one invoice block, suffixed with its sequence only when the paying client
    /// holds more than one invoice on the run — otherwise a single invoice is not saddled with a
    /// meaningless "1".
    /// </summary>
    /// <remarks>
    /// Shared by both export writers so they cannot drift into disagreeing about which headings
    /// need the suffix. Keyed on <see cref="ShipmentExportInvoice.PayingClientId"/> rather than
    /// the name, because two distinct clients can genuinely share a name.
    /// </remarks>
    public static string InvoiceHeading(ShipmentExportInvoice invoice, IReadOnlyDictionary<Guid, int> invoiceCountByPayer) =>
        invoiceCountByPayer[invoice.PayingClientId] > 1
            ? $"{invoice.PayingClientName} · Faktura {invoice.Sequence}"
            : invoice.PayingClientName;

    /// <summary>How many invoices each paying client holds on the run, for <see cref="InvoiceHeading"/>.</summary>
    public static Dictionary<Guid, int> InvoiceCountByPayer(IEnumerable<ShipmentExportInvoice> invoices) =>
        invoices.GroupBy(i => i.PayingClientId).ToDictionary(g => g.Key, g => g.Count());

    /// <summary>Heading for one invoice party's block, marking the payer's own goods.</summary>
    public static string PartyHeading(ShipmentExportInvoiceParty party) =>
        party.IsPayer ? $"{party.ClientName} · vlastní zboží" : party.ClientName;

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
