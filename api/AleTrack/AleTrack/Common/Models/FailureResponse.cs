using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace AleTrack.Common.Models;

/// <summary>
/// Universal failure response for TEH API's
/// </summary>
public class FailureResponse
{
    /// <summary>
    /// Error code of the exception - specified identifier in case of multiple same error types in feature
    /// </summary>
    [DataType(DataType.Text)]
    [JsonPropertyName("error_code")]
    public string ErrorCode { get; set; }

    /// <summary>
    /// Dictionary of validation errors where key is name of the property and value is array of error messages
    /// </summary>
    [JsonPropertyName("error_properties")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IDictionary<string, object>? ErrorProperties { get; init; }

    /// <summary>
    /// Detailed description of the error or failure that occurred.
    /// </summary>
    [DataType(DataType.Text)]
    [JsonPropertyName("message")]
    public string Message { get; set; }

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="message">Error message</param>
    /// <param name="errorCode">Error code of the problem</param>
    /// <param name="errorProperties">Optional dictionary of validation errors</param>
    public FailureResponse(string message, string errorCode, IDictionary<string, object>? errorProperties = null)
    {
        ErrorCode = errorCode;
        ErrorProperties = errorProperties;
        Message = message;
    }
}
