namespace AleTrack.Features.InventoryItems.Commands.Update;

/// <summary>
/// Data transfer object representing the details required for updating an inventory item.
/// </summary>
/// <remarks>
/// This DTO encapsulates the necessary properties that can be updated for an inventory item,
/// allowing for structured data handling in update operations.
/// </remarks>
public sealed record UpdateInventoryItemDto
{
    /// <summary>
    /// Public ID of related product
    /// </summary>
    public Guid? ProductId { get; set; }
    
    /// <summary>
    /// Name of the item
    /// </summary>
    public string? Name { get; set; }
    
    /// <summary>
    /// Amount of the item
    /// </summary>
    public int Amount { get; set; }
    
    /// <summary>
    /// Note to the item
    /// </summary>
    public string? Note { get; set; }
}