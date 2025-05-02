namespace AleTrack.Features.InventoryItems.Queries.Detail;

public sealed record InventoryItemDto
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
    
    /// <summary>
    /// Note to the item
    /// </summary>
    public string? Note { get; set; }
}