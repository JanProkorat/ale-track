using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Billing details captured for a <see cref="Sale"/> paid by invoice.
/// </summary>
/// <remarks>
/// The invoice document itself is issued in the accounting software — this only records who it
/// is issued to and whether it has been paid. Every address part is nullable, which is why the
/// owned <see cref="Address"/> type is not reused here: its street, city and zip are
/// <see cref="RequiredAttribute"/>, while a walk-in invoice frequently arrives as a name plus
/// an IČO and nothing else.
/// </remarks>
[Owned]
public class SaleBillingDetails
{
    /// <summary>
    /// Name or company name the invoice is issued to.
    /// </summary>
    [MaxLength(100)]
    [Column("billing_name")]
    public string? Name { get; set; }

    /// <summary>
    /// IČO of the buyer.
    /// </summary>
    [MaxLength(20)]
    [Column("billing_company_id")]
    public string? CompanyId { get; set; }

    /// <summary>
    /// DIČ of the buyer.
    /// </summary>
    [MaxLength(20)]
    [Column("billing_vat_id")]
    public string? VatId { get; set; }

    /// <summary>
    /// Name of the street.
    /// </summary>
    [MaxLength(50)]
    [Column("billing_street_name")]
    public string? StreetName { get; set; }

    /// <summary>
    /// Street number.
    /// </summary>
    [MaxLength(50)]
    [Column("billing_street_number")]
    public string? StreetNumber { get; set; }

    /// <summary>
    /// Name of the city.
    /// </summary>
    [MaxLength(50)]
    [Column("billing_city")]
    public string? City { get; set; }

    /// <summary>
    /// Zip code.
    /// </summary>
    [MaxLength(50)]
    [Column("billing_zip")]
    public string? Zip { get; set; }

    /// <summary>
    /// Date the invoice is due.
    /// </summary>
    [Column("billing_due_date")]
    public DateOnly? DueDate { get; set; }

    /// <summary>
    /// Date the invoice was settled. Whether it is settled at all is the sale's state
    /// (<see cref="Common.Enums.SaleState.AwaitingPayment"/> vs
    /// <see cref="Common.Enums.SaleState.Completed"/>) — a separate paid flag would be a second
    /// source of truth for the same fact and would drift from it.
    /// </summary>
    [Column("billing_paid_date")]
    public DateOnly? PaidDate { get; set; }
}
