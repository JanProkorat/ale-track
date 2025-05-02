using AleTrack.Common.Enums;

namespace AleTrack.Features.Orders.Queries.Detail;

public sealed record OrderDto
{
    /// <summary>
    /// ID of the order
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Info about related client
    /// </summary>
    public ClientInfo Client { get; set; } = null!;
    
    /// <summary>
    /// State of the order
    /// </summary>
    public OrderState State { get; set; }
    
    /// <summary>
    /// Date when order needs to be delivered to the client
    /// Can be null only in state <see cref="OrderState.New"/>
    /// </summary>
    public DateTime? DeliveryDate { get; set; }
    
    /// <summary>
    /// Date when the order was created
    /// </summary>
    public DateTime CreatedDate { get; set; }
}

/// <summary>
/// Represents a client associated with an order, encapsulating identifying details.
/// </summary>
public sealed record ClientInfo
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