using AleTrack.Common.Enums;

namespace AleTrack.Features.Sales.Queries.Reports.Buyers;

/// <summary>
/// Who bought at the counter over a window, and how much of the till they account for.
/// </summary>
public sealed record GarageSalesBuyersReportDto
{
    /// <summary>
    /// Known clients versus anonymous walk-ins. Walk-ins are one bucket by design — a typed name
    /// identifies nobody, so splitting on it would invent customers.
    /// </summary>
    public List<BuyerKindRowDto> ByBuyerKind { get; set; } = [];

    /// <summary>Every buying client, highest revenue first. The frontend slices its top N.</summary>
    public List<BuyerClientRowDto> TopClients { get; set; } = [];

    /// <summary>Clients with two or more completed sales in the window.</summary>
    public int RepeatBuyers { get; set; }

    /// <summary>Clients with exactly one completed sale in the window.</summary>
    public int OneTimeBuyers { get; set; }
}

/// <summary>Revenue taken from one kind of buyer.</summary>
public sealed record BuyerKindRowDto
{
    public SaleBuyerKind BuyerKind { get; set; }
    public decimal Revenue { get; set; }
    public int SalesCount { get; set; }
}

/// <summary>One client's counter purchases over the window.</summary>
public sealed record BuyerClientRowDto
{
    /// <summary>Public id of the client — the frontend links to /clients/{id} with it.</summary>
    public Guid ClientId { get; set; }

    public string ClientName { get; set; } = null!;
    public int SalesCount { get; set; }
    public decimal Revenue { get; set; }

    /// <summary>Date of this client's newest completed sale inside the window.</summary>
    public DateOnly LastPurchase { get; set; }
}
