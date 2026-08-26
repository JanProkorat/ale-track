using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Orders.Utils;
using AleTrack.Features.Reminders.Commands.Create;

namespace AleTrack.Features.Orders.Commands.Create;

/// <summary>
/// Represents a data transfer object for creating an order,
/// including client details, delivery date, and a list of order items.
/// </summary>
public sealed record CreateOrderDto
{
    /// <summary>
    /// ID of related <see cref="Client"/>
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Where this order is delivered. Defaults to
    /// <see cref="DeliveryAddressKind.Official"/>.
    /// </summary>
    public DeliveryAddressKind DeliveryAddressKind { get; set; }

    /// <summary>
    /// The client's saved delivery place. Required when
    /// <see cref="DeliveryAddressKind"/> is
    /// <see cref="Common.Enums.DeliveryAddressKind.DeliveryPlace"/>, and must
    /// be null otherwise.
    /// </summary>
    public Guid? ClientDeliveryPlaceId { get; set; }

    /// <summary>
    /// Latest date when order needs to be delivered to the client
    /// </summary>
    public DateOnly? RequiredDeliveryDate { get; set; }

    /// <summary>
    /// Free-form notes about the order.
    /// </summary>
    public List<OrderNoteDto> Notes { get; set; } = [];

    /// <summary>
    /// List of items included in the order
    /// </summary>
    public List<CreateOrderItemDto> OrderItems { get; set; } = [];

    /// <summary>
    /// Returnable items the client hands back against this order (empty kegs, bottles…).
    /// </summary>
    public List<OrderReturnDto> Returns { get; set; } = [];

    /// <summary>
    /// Items the client wants that no brewery supplies.
    /// </summary>
    public List<OrderCustomExtraItemDto> CustomExtraItems { get; set; } = [];

    /// <summary>
    /// Lines bought off a supplier's price list — gas, packaging, sanitation.
    /// </summary>
    public List<OrderSupplierGoodItemDto> SupplierGoodItems { get; set; } = [];

    /// <summary>
    /// Public IDs of the client's open ledger entries this order is going to settle.
    /// </summary>
    /// <remarks>
    /// Assigning does not settle anything: the entries close when this order is actually
    /// delivered, because promising is not delivering.
    /// </remarks>
    public List<Guid> SettledLedgerEntryIds { get; set; } = [];
}

/// <summary>
/// Represents a data transfer object for creating an order item,
/// containing details about the product and its quantity.
/// </summary>
public sealed record CreateOrderItemDto
{
    /// <summary>
    /// Id of related <see cref="Product"/>
    /// </summary>
    public Guid ProductId { get; set; }
    
    /// <summary>
    /// Amount of goods ordered
    /// </summary>
    public int Quantity { get; set; }
    
    /// <summary>
    /// State of the reminder for this item.
    /// </summary>
    public OrderItemReminderState? ReminderState { get; set; }

    /// <summary>
    /// Optional free-form note about this line.
    /// </summary>
    public string? Note { get; set; }
}