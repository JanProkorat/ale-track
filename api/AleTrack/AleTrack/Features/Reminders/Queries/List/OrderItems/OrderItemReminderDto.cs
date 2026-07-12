namespace AleTrack.Features.Reminders.Queries.List.OrderItems;

public record ClientOrderReminderDto
{
    /// <summary>
    /// ID of the client
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Name
    /// </summary>
    public string ClientName { get; set; } = null!;
    
    /// <summary>
    /// List of order item reminders associated with the client
    /// </summary>
    public List<OrderItemReminderDto> OrderItems { get; set; } = [];
}

public record OrderItemReminderDto
{
    /// <summary>
    /// ID of the related order
    /// </summary>
    public Guid OrderId { get; set; }

    /// <summary>
    /// Public ID of the related product
    /// </summary>
    public Guid ProductId { get; set; }
    
    /// <summary>
    /// Name of the related product
    /// </summary>
    public string ProductName { get; set; } = null!;
    
    /// <summary>
    /// Size of the related product package.
    /// </summary>
    public double? PackageSize { get; set; }
    
    /// <summary>
    /// Quantity of the related product to order
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Name of the client associated with the order
    /// </summary>
    public string ClientName { get; set; } = null!;
    
    /// <summary>
    /// Delivery date of the related order
    /// </summary>
    public DateOnly? DeliveryDate { get; set; }
}