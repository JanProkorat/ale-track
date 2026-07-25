using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A named delivery location saved on a client — a third option next to the
/// client's official and contact addresses when planning an outgoing shipment
/// stop. Created either from an address search or by picking a point on the
/// map, so the postal parts are optional but the coordinates never are.
/// </summary>
[Table("client_delivery_places")]
public sealed class ClientDeliveryPlace : PublicSoftlyDeletableEntity
{
    /// <summary>
    /// ID of the owning <see cref="Client"/>
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }

    /// <summary>
    /// Name shown in the picker, e.g. "Letní zahrádka".
    /// </summary>
    [MaxLength(100)]
    [Required]
    [Column("name")]
    public string Name { get; set; } = null!;

    /// <summary>
    /// Instruction for the driver, e.g. "Vjezd zezadu, brána od 8:00".
    /// </summary>
    [MaxLength(200)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// Location of the place. Street/city parts are optional — a place picked
    /// straight off the map has coordinates only.
    /// </summary>
    public Address Address { get; set; } = null!;

    /// <summary>
    /// The owning <see cref="Client"/>
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Client Client { get; set; } = null!;
}
