using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A price this client pays for one product, in place of the brewery's ceník price.
/// </summary>
/// <remarks>
/// Deliberately not softly deletable: removing the row reverts the client to the ceník
/// price and cannot rewrite history, because every invoice line froze its own
/// <see cref="OutgoingShipmentInvoiceLine.UnitPriceWithVat"/> at billing time.
/// </remarks>
[Table("client_product_prices")]
public sealed class ClientProductPrice : PublicEntity
{
    /// <summary>
    /// ID of the owning <see cref="Entities.Client"/>
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }

    /// <summary>
    /// ID of the priced <see cref="Entities.Product"/>
    /// </summary>
    [Column("product_id")]
    public long ProductId { get; set; }

    /// <summary>
    /// The only operator-entered value; the other three price fields are derived from
    /// the product's own ratios at read time.
    /// </summary>
    [Column("price_with_vat")]
    public required decimal PriceWithVat { get; set; }

    /// <summary>
    /// When this price was last decided. Provenance only — nothing reads it to decide
    /// whether the price applies, and it is not a validity date.
    /// </summary>
    [Column("set_on")]
    public required DateOnly SetOn { get; set; }

    /// <summary>
    /// The owning client. Cascade: deleting a client drops its price list.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Client Client { get; set; } = null!;

    /// <summary>
    /// The priced product. Restrict, not the EF default — a product must not be
    /// deletable out from under rows referencing it without the caller noticing.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Product Product { get; set; } = null!;
}
