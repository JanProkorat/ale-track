using AleTrack.Common.Enums;

namespace AleTrack.Features.Sales.Queries.Reports.Revenue;

/// <summary>
/// What the counter took over a window, how it was paid for, and what is still owed.
/// </summary>
/// <remarks>
/// Every amount is with VAT: <see cref="Entities.SaleItem"/> snapshots only
/// <see cref="Entities.SaleItem.UnitPriceWithVat"/>, so a VAT-exclusive total would have to be
/// reconstructed from a ceník that has since moved.
/// </remarks>
public sealed record GarageSalesRevenueReportDto
{
    /// <summary>Total taken in the window, with VAT.</summary>
    public decimal TotalRevenue { get; set; }

    /// <summary>Completed sales in the window.</summary>
    public int SalesCount { get; set; }

    /// <summary>Mean sale value, rounded to halerze. Zero when nothing was sold.</summary>
    public decimal AverageSale { get; set; }

    /// <summary>Pieces sold across every line.</summary>
    public int TotalUnits { get; set; }

    /// <summary>Litres sold, from lines that carry a package size.</summary>
    public double TotalLitres { get; set; }

    /// <summary>Revenue per bucket, oldest first.</summary>
    public List<RevenueSeriesPointDto> Trend { get; set; } = [];

    /// <summary>Cash versus invoice, heaviest first.</summary>
    public List<RevenueByPaymentDto> ByPayment { get; set; } = [];

    /// <summary>
    /// Every completed invoice sale still unpaid, oldest first — deliberately NOT limited to the
    /// report window, because an invoice that went unpaid months ago is the one worth chasing.
    /// </summary>
    public List<UnpaidInvoiceRowDto> UnpaidInvoices { get; set; } = [];

    /// <summary>Sum of <see cref="UnpaidInvoices"/>.</summary>
    public decimal UnpaidTotal { get; set; }
}

/// <summary>One point of the revenue trend.</summary>
public sealed record RevenueSeriesPointDto
{
    /// <summary>First day of the bucket — the day itself, its ISO Monday, or the 1st of the month.</summary>
    public DateOnly BucketStart { get; set; }

    public decimal Revenue { get; set; }
    public int SalesCount { get; set; }
}

/// <summary>Revenue taken through one payment method.</summary>
public sealed record RevenueByPaymentDto
{
    public SalePaymentMethod Payment { get; set; }
    public decimal Revenue { get; set; }
    public int SalesCount { get; set; }
}

/// <summary>One outstanding invoice sale.</summary>
public sealed record UnpaidInvoiceRowDto
{
    /// <summary>Public id of the sale — the frontend links to /sales/{id} with it.</summary>
    public Guid SaleId { get; set; }

    public DateOnly SaleDate { get; set; }

    /// <summary>Agreed due date, when one was recorded.</summary>
    public DateOnly? DueDate { get; set; }

    /// <summary>Public id of the buying client, null for a walk-in.</summary>
    public Guid? ClientId { get; set; }

    /// <summary>Client name or the typed walk-in name. Null for an anonymous cash-desk invoice.</summary>
    public string? BuyerLabel { get; set; }

    public decimal Amount { get; set; }

    /// <summary>
    /// Days past the due date — negative while the invoice is still within terms, null when no
    /// due date was agreed, since there is then nothing to be late against.
    /// </summary>
    public int? DaysOverdue { get; set; }
}
