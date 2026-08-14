namespace AleTrack.Features.Sales.Utils;

/// <summary>
/// Billing details of a sale paid by invoice, as sent by the client.
/// </summary>
/// <remarks>
/// The paid flag is deliberately absent: it is moved by its own command, not by editing the sale,
/// so marking an invoice paid does not require reopening a frozen record.
/// </remarks>
public sealed record SaleBillingDto
{
    /// <summary>
    /// Name or company name the invoice is issued to.
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// IČO of the buyer.
    /// </summary>
    public string? CompanyId { get; set; }

    /// <summary>
    /// DIČ of the buyer.
    /// </summary>
    public string? VatId { get; set; }

    /// <summary>
    /// Name of the street.
    /// </summary>
    public string? StreetName { get; set; }

    /// <summary>
    /// Street number.
    /// </summary>
    public string? StreetNumber { get; set; }

    /// <summary>
    /// Name of the city.
    /// </summary>
    public string? City { get; set; }

    /// <summary>
    /// Zip code.
    /// </summary>
    public string? Zip { get; set; }

    /// <summary>
    /// Date the invoice is due.
    /// </summary>
    public DateOnly? DueDate { get; set; }
}
