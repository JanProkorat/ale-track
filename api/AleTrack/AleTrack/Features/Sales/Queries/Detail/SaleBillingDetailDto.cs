namespace AleTrack.Features.Sales.Queries.Detail;

/// <summary>
/// Billing details of a garage sale as returned to the client.
/// </summary>
public sealed record SaleBillingDetailDto
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

    /// <summary>
    /// Date the invoice was settled. Whether it is settled is the sale's state, not a flag here.
    /// </summary>
    public DateOnly? PaidDate { get; set; }
}
