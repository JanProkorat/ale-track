namespace AleTrack.Common.Models;

public sealed class AleTrackException : Exception
{
    /// <summary>
    /// Code of the exception
    /// </summary>
    public int StatusCode { get; set; }
    
    /// <summary>
    /// Related error code
    /// </summary>
    public string ErrorCode { get; set; }
    
    /// <summary>
    /// Dict with properties to be added dynamically to error message translation
    /// </summary>
    public IDictionary<string, object>? ErrorProperties { get; set; }

    /// <summary>
    /// Represents a custom exception specific to the AleTrack application.
    /// This exception provides additional details such as the status code,
    /// error code, type name, and custom error properties for more granular error handling.
    /// </summary>
    public AleTrackException(int statusCode, string errorCode, IDictionary<string, object>? errorProperties = null)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
        ErrorProperties = errorProperties;
    }
}