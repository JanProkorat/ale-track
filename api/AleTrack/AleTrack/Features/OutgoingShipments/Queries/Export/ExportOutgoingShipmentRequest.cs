namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Request to export an outgoing shipment. Shared by the spreadsheet and document endpoints, which
/// differ only in what they write.
/// </summary>
public sealed record ExportOutgoingShipmentRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment to export.
    /// </summary>
    public Guid Id { get; set; }
}
