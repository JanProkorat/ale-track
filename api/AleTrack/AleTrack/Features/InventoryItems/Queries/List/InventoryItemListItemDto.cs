namespace AleTrack.Features.InventoryItems.Queries.List;

/// <summary>
/// Represents a data transfer object for an inventory item, commonly used to encapsulate
/// detail information retrieved from the database and sent as part of a response.
/// </summary>
public sealed record InventoryItemListItemDto
{
    /// <summary>
    /// Public ID of the inventory idem
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Name of the inventory item
    /// </summary>
    public string? Name { get; set; }
    
    /// <summary>
    /// Public ID of related product
    /// </summary>
    public Guid? ProductId { get; set; }
    
    /// <summary>
    /// Amount of products currently in inventory
    /// </summary>
    public int Amount { get; set; }
}