using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents an order from client.
/// An order is associated with a specific client and consists of multiple order items.
/// It tracks its current state, creation date, and the expected delivery date.
/// </summary>
[Table("orders")]
public sealed class Order : PublicEntity
{
    /// <summary>
    /// ID of related <see cref="Client"/>
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }

    /// <summary>
    /// State of the order
    /// </summary>
    [Column("state")]
    public OrderState State { get; set; }
    
    /// <summary>
    /// Date when order needs to be delivered to the client
    /// Can be null only in state <see cref="OrderState.New"/>
    /// </summary>
    [Column("delivery_date")]
    public DateOnly? DeliveryDate { get; set; }
    
    /// <summary>
    /// Date when the order was created
    /// </summary>
    [Column("created_date")]
    public DateTime CreatedDate { get; set; }
    
    /// <summary>
    /// Related items to be ordered
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OrderItem> OrderItems { get; set; } = [];
    
    /// <summary>
    /// Related client
    /// </summary>
    public Client Client { get; set; } = null!;
}