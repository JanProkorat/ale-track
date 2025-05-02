namespace AleTrack.Features.Products.Commands.Ceate;

/// <summary>
/// Represents the data transfer object for creating multiple products.
/// </summary>
public sealed record CreateProductsDto
{
    /// <summary>
    /// List of products to be added
    /// </summary>
    public List<CreateProductDto> Products { get; set; } = [];
}

/// <summary>
/// Represents the data transfer object for creating a product.
/// </summary>
public sealed record CreateProductDto
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