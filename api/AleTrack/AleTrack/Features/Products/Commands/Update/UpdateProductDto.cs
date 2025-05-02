namespace AleTrack.Features.Products.Commands.Update;

/// <summary>
/// Represents the data transfer object for updating a product.
/// </summary>
public sealed record UpdateProductDto
{
    /// <summary>
    /// Name of the product
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Price per one unit
    /// </summary>
    public decimal Price { get; set; }
    
    /// <summary>
    /// Description of the product
    /// </summary>
    public string? Description { get; set; }
}