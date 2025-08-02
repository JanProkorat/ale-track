using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

[Table("driver_availabilities")]
public sealed class DriverAvailability : BaseEntity
{
    /// <summary>
    /// ID of the related driver
    /// </summary>
    [Column("driver_id")]
    public long DriverId { get; set; }
    
    /// <summary>
    /// From when is the driver available
    /// </summary>
    [Column("from")]
    public DateTime From { get; set; }

    /// <summary>
    /// Until when is the driver available
    /// </summary>
    [Column("until")]
    public DateTime Until { get; set; }
    
    /// <summary>
    /// Related driver
    /// </summary>
    public Driver Driver { get; set; } = null!;
}