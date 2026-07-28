using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// One thing that has to be done while the shipment is being prepared, ticked off on the detail
/// screen as the dispatcher works through the list.
/// </summary>
/// <remarks>
/// Free text rather than a fixed enum of steps: what preparing a run involves differs per run,
/// and the list is written in the editor by whoever plans it.
///
/// The tick is progress, not content — like <see cref="OutgoingShipmentLoadingState"/> it stays
/// changeable until the shipment is delivered, and it is deliberately not part of what the editor
/// writes (see the update endpoint).
/// </remarks>
[Table("outgoing_shipment_preparation_steps")]
public sealed class OutgoingShipmentPreparationStep : PublicEntity
{
    /// <summary>
    /// ID of the related <see cref="OutgoingShipment"/>
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// Position of the step within the shipment's list.
    /// </summary>
    [Column("order")]
    public int Order { get; set; }

    /// <summary>
    /// What has to be done.
    /// </summary>
    [Column("label")]
    [MaxLength(200)]
    [Required]
    public string Label { get; set; } = null!;

    /// <summary>
    /// Whether the step has been done.
    /// </summary>
    [Column("is_done")]
    public bool IsDone { get; set; }

    /// <summary>
    /// Outgoing shipment this step belongs to
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;
}
