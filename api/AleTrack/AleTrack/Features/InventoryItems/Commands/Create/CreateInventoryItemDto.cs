namespace AleTrack.Features.InventoryItems.Commands.Create;

/// <summary>
/// Data transfer object used for creating an inventory item.
/// </summary>
/// <remarks>
/// This class represents the necessary data required to create an inventory item,
/// including properties such as ProductId, Name, Amount, and Note.
/// </remarks>
public sealed record CreateInventoryItemDto
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
    public int Quantity { get; set; }
    
    /// <summary>
    /// Note to the item
    /// </summary>
    public string? Note { get; set; }
}