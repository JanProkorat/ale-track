using AleTrack.Common.Enums;

namespace AleTrack.Features.Reports.Queries.ClientVolume;

/// <summary>Who took delivery over a window, how often and how much.</summary>
public sealed record ClientVolumeReportDto
{
    /// <summary>Distinct clients with at least one delivered line.</summary>
    public int ClientsServed { get; set; }

    /// <summary>Distinct delivered shipment stops across all clients — one stop is one drop-off.</summary>
    public int TotalDeliveries { get; set; }

    public decimal TotalWeightKg { get; set; }

    /// <summary>Every client with volume, heaviest first. The frontend slices the top 10 for its chart.</summary>
    public List<ClientVolumeRowDto> TopClients { get; set; } = [];

    public List<VolumeByRegionDto> ByRegion { get; set; } = [];
}

public sealed record ClientVolumeRowDto
{
    /// <summary>The client's public id — the frontend links to /clients/{id} with it.</summary>
    public Guid ClientId { get; set; }

    public string ClientName { get; set; } = null!;
    public Region Region { get; set; }

    /// <summary>Distinct delivered stops for this client in the window.</summary>
    public int Deliveries { get; set; }

    public int Units { get; set; }
    public decimal WeightKg { get; set; }
}

public sealed record VolumeByRegionDto
{
    public Region Region { get; set; }
    public int Units { get; set; }
    public decimal WeightKg { get; set; }
}
