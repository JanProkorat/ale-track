using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

[Index(nameof(CurrencyCode), IsUnique = true)]
[Table("exchange_rates")]
public class ExchangeRate: BaseEntity
{
    /// <summary>
    /// Represents the currency code associated with an exchange rate.
    /// </summary>
    /// <remarks>
    /// The CurrencyCode property is a string that identifies the type of currency,
    /// typically following ISO 4217 standard codes (e.g., "USD" for US Dollar,
    /// "EUR" for Euro). This property ensures proper identification of the
    /// currency used in exchange rate transactions.
    /// </remarks>
    [Required]
    [MaxLength(3)]
    [Column("currency_code")]
    public string CurrencyCode { get; set; } = null!;

    /// <summary>
    /// Represents the rate of exchange for a specific currency.
    /// </summary>
    /// <remarks>
    /// The Rate property indicates the numerical value of the exchange rate
    /// associated with a specific currency. It is expressed as a decimal
    /// and denotes the value of one unit of the specified currency in relation
    /// to another reference currency. This property plays a crucial role in
    /// financial computations and currency-related transactions.
    /// </remarks>
    [Column("rate")]
    public decimal Rate { get; set; }
    
    /// <summary>
    /// Date for which the exchange rate is valid
    /// </summary>
    [Column("updated_date")]
    public DateOnly UpdatedDate { get; set; }
}