using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing product sold by a brewery
/// </summary>
[Table("products")]
public sealed class Product : PublicEntity
{
    /// <summary>
    /// ID of related <see cref="Brewery"/>
    /// </summary>
    [Column("brewery_id")]
    public long BreweryId { get; set; }
    
    /// <summary>
    /// Name of the product
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("name")]
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Price per one unit
    /// </summary>
    [Column("price")]
    public decimal Price { get; set; }
    
    /// <summary>
    /// Note to the product
    /// </summary>
    [MaxLength(200)]
    [Column("description")]
    public string? Description { get; set; }
    
    /// <summary>
    /// Related Brewery
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Brewery Brewery { get; set; } = null!;
}