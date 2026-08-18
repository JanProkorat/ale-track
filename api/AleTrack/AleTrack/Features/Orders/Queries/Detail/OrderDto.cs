using AleTrack.Common.Enums;
using AleTrack.Features.Orders.Utils;

namespace AleTrack.Features.Orders.Queries.Detail;

/// <summary>
/// Represents the detailed data transfer object for an order, including associated client information,
/// order status, delivery date, creation date, and a list of order items.
/// </summary>
public sealed record OrderDto
{
    /// <summary>
    /// ID of the order
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Info about related client
    /// </summary>
    public ClientInfoDto Client { get; set; } = null!;

    /// <summary>
    /// Where this order is delivered, resolved
    /// </summary>
    public OrderDeliveryAddressDto DeliveryAddress { get; set; } = null!;

    /// <summary>
    /// State of the order
    /// </summary>
    public OrderState State { get; set; }
    
    /// <summary>
    /// The latest date when order needs to be delivered to the client
    /// Can be null only in state <see cref="OrderState.New"/>
    /// </summary>
    public DateOnly? RequiredDeliveryDate { get; set; }
    
    /// <summary>
    /// Date when the order was actually delivered to the client
    /// Null if the order has not been delivered yet
    /// </summary>
    public DateOnly? ActualDeliveryDate { get; set; }
    
    /// <summary>
    /// Date when the order was created
    /// </summary>
    public DateTime CreatedDate { get; set; }

    /// <summary>
    /// Free-form notes about the order, oldest first
    /// </summary>
    public List<OrderNoteDto> Notes { get; set; } = [];

    /// <summary>
    /// Collection of items associated with the order.
    /// </summary>
    public List<OrderItemDto> OrderItems { get; set; } = [];

    /// <summary>
    /// Returnable items the client hands back against this order (empty kegs, bottles…)
    /// </summary>
    public List<OrderReturnDto> Returns { get; set; } = [];

    /// <summary>
    /// Items the client wants that no brewery supplies
    /// </summary>
    public List<OrderCustomExtraItemDto> CustomExtraItems { get; set; } = [];

    /// <summary>
    /// The outgoing shipment carrying this order. Null when the order is not
    /// planned onto a run, or when the run it was on has been cancelled.
    /// </summary>
    public OrderOutgoingShipmentDto? OutgoingShipment { get; set; }
}

/// <summary>
/// Represents a client associated with an order, encapsulating identifying details.
/// </summary>
public sealed record ClientInfoDto
{
    /// <summary>
    /// ID of the client
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Name of the client
    /// </summary>
    public string Name { get; set; } = null!;
}


/// <summary>
/// Represents a data transfer object for an order item.
/// </summary>
public sealed record OrderItemDto
{
    /// <summary>
    /// Public ID of the item
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// ID of related order
    /// </summary>
    public Guid OrderId { get; set; }
    
    /// <summary>
    /// ID of related product
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Name of related product
    /// </summary>
    public string ProductName { get; set; } = null!;

    /// <summary>
    /// Represents the quantity of the product in the order item.
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Unit price with VAT: the frozen snapshot price once the order has been loaded,
    /// otherwise the client's live-resolved price.
    /// </summary>
    public decimal UnitPriceWithVat { get; set; }

    /// <summary>
    /// The ceník price this stands in for. Null for snapshot-fed rows: the snapshot never
    /// recorded the ceník price of the day, and today's beside a frozen one would mislead.
    /// </summary>
    public decimal? ListPriceWithVat { get; set; }

    /// <summary>
    /// State of the reminder for this item.
    /// </summary>
    public OrderItemReminderState? ReminderState { get; set; }

    /// <summary>
    /// Optional free-form note about this line.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Display order based on brewery.
    /// </summary>
    public int BreweryDisplayOrder { get; set; }
    
    /// <summary>
    /// Display order of the product based on the Product kind
    /// </summary>
    public int DisplayOrder { get; set; }
}