namespace AleTrack.Features.InventoryItems.Queries.List;

public sealed record InventorySectionDto
{
    /// <summary>
    /// ID of the inventory section
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Name of the section
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// List of inventory items in the section
    /// </summary>
    public List<InventoryItemListItemDto> Items { get; set; } = [];
}