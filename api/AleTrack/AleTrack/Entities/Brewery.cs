using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing a brewery
/// </summary>
[Table("breweries")]
public sealed class Brewery : LocationEntity
{
    /// <summary>
    /// Name of the brewery
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("name")]
    public string Name { get; set; } = null!;

    /// <summary>
    /// List of related products
    /// </summary>
    public ICollection<Product> Products { get; set; } = [];
}