using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing a brewery
/// </summary>
[Table("breweries")]
public sealed class Brewery : PublicEntity
{
    /// <summary>
    /// Name of the brewery
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("name")]
    public string Name { get; set; } = null!;

    /// <summary>
    /// Order in which the brewery should be displayed in tabs
    /// </summary>
    public int DisplayOrder { get; set; }
    
    /// <summary>
    /// Official address of the brewery
    /// </summary>
    public Address OfficialAddress { get; set; } = null!;

    /// <summary>
    /// Contact address of the brewery, which can be null
    /// </summary>
    public Address? ContactAddress { get; set; }
    
    /// <summary>
    /// List of related products
    /// </summary>
    public List<Product> Products { get; set; } = [];
}