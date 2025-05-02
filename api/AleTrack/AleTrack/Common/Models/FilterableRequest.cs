using FastEndpoints;

namespace AleTrack.Common.Models;

/// <summary>
/// Base request for endpoints containing query params
/// </summary>
public record FilterableRequest
{
    /// <summary>
    /// Filter parameters
    /// </summary>
    [QueryParam]
    public Dictionary<string, string> Parameters { get; set; } = new();
}
