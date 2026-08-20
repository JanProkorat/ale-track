namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// One step of the shipment preparation checklist, as the editor writes it.
/// </summary>
/// <remarks>
/// Carries no done flag on purpose: the editor defines the list, the detail screen ticks it.
/// Steps are matched by <see cref="Id"/> on update so an existing step keeps the tick it already
/// has — including when an unrelated save (a nakládka toggle on the detail screen) resends the
/// whole shipment.
/// </remarks>
public sealed record PreparationStepDto
{
    /// <summary>
    /// Public ID of an existing step. Null when adding a new one.
    /// </summary>
    public Guid? Id { get; set; }

    /// <summary>
    /// Position of the step within the list.
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// What has to be done.
    /// </summary>
    public string Label { get; set; } = null!;
}
