using AleTrack.Common.Enums;

namespace AleTrack.Features.Reports.Queries.Operations;

/// <summary>How the operation ran over a window — throughput, punctuality, returns, drivers.</summary>
public sealed record OperationsReportDto
{
    /// <summary>Outgoing shipments in the window, by state. Includes non-delivered states.</summary>
    public List<ShipmentStateCountDto> ShipmentsByState { get; set; } = [];

    /// <summary>All outgoing shipments in the window, any state.</summary>
    public int TotalShipments { get; set; }

    /// <summary>Order stops across those shipments — the drop-off count.</summary>
    public int TotalStops { get; set; }

    /// <summary>
    /// Percent of finished orders delivered by their required date. Orders without a required
    /// date are excluded from the ratio; 0 when nothing qualifies.
    /// </summary>
    public decimal OnTimePercentage { get; set; }

    /// <summary>Returnable units handed back on delivered shipments.</summary>
    public int ReturnableUnits { get; set; }

    /// <summary>Drivers with at least one delivered shipment in the window.</summary>
    public int ActiveDrivers { get; set; }

    /// <summary>Incoming vs outgoing weight per calendar month, both in kilograms on one scale.</summary>
    public List<IncomingVsOutgoingDto> IncomingVsOutgoing { get; set; } = [];

    public List<DriverShipmentsDto> ByDriver { get; set; } = [];
}

/// <summary>How many outgoing shipments landed in a given state.</summary>
public sealed record ShipmentStateCountDto
{
    public OutgoingShipmentState State { get; set; }
    public int Count { get; set; }
}

/// <summary>One month's incoming vs outgoing weight, both in kilograms.</summary>
public sealed record IncomingVsOutgoingDto
{
    /// <summary>First day of the month the pair belongs to.</summary>
    public DateOnly Month { get; set; }

    public decimal IncomingWeightKg { get; set; }
    public decimal OutgoingWeightKg { get; set; }
}

/// <summary>One driver's delivered-shipment throughput.</summary>
public sealed record DriverShipmentsDto
{
    public Guid DriverId { get; set; }
    public string DriverName { get; set; } = null!;

    /// <summary>The driver's own display colour, so the chart keys off the entity, not its rank.</summary>
    public string? Color { get; set; }

    public int DeliveredShipments { get; set; }
}
