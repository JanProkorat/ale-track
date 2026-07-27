using AleTrack.Common.Enums;
using AleTrack.Features.Reports.Utils;

namespace AleTrack.Features.Reports.Queries.DeliveryVolume;

/// <summary>Delivered volume over a window — totals, breakdowns and a trend series.</summary>
public sealed record DeliveryVolumeReportDto
{
    public decimal TotalWeightKg { get; set; }
    public int TotalUnits { get; set; }

    /// <summary>Distinct clients that received at least one line in the window.</summary>
    public int ClientsServed { get; set; }

    public List<VolumeByKindDto> UnitsByKind { get; set; } = [];
    public List<VolumeByBreweryDto> ByBrewery { get; set; } = [];
    public List<VolumeByTypeDto> ByType { get; set; } = [];
    public List<ReportSeriesPointDto> Series { get; set; } = [];
}

public sealed record VolumeByKindDto
{
    public ProductKind Kind { get; set; }
    public int Units { get; set; }
    public decimal WeightKg { get; set; }
}

public sealed record VolumeByBreweryDto
{
    public Guid BreweryId { get; set; }
    public string BreweryName { get; set; } = null!;

    /// <summary>The brewery's own display colour, so charts key off the entity, not its rank.</summary>
    public string? Color { get; set; }

    public int Units { get; set; }
    public decimal WeightKg { get; set; }
}

public sealed record VolumeByTypeDto
{
    public ProductType Type { get; set; }
    public int Units { get; set; }
    public decimal WeightKg { get; set; }
}
