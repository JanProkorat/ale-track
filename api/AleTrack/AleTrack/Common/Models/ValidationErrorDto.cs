using System.Text.Json.Serialization;

namespace AleTrack.Common.Models;

/// <summary>
/// Wrapper for validation error data
/// </summary>
public record ValidationErrorDto
{
    /// <summary>
    /// Error code
    /// </summary>
    [JsonPropertyName("error_code")]
    public string ErrorCode { get; set; } = null!;
    
    /// <summary>
    /// Error message
    /// </summary>
    [JsonPropertyName("error_message")]
    public string ErrorMessage { get; set; } = null!;
}
