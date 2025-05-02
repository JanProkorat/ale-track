using System.Text.Json;
using FastEndpoints;

namespace AleTrack.Common.Utils;

/// <summary>
/// Utils for fast endpoints
/// </summary>
internal static class FastEndpointExtensions
{
    /// <summary>
    /// Sets <see cref="FailureResponse"/> for specific status code with desired exception type
    /// </summary>
    /// <param name="endpointSummary"><see cref="EndpointSummary"/> where response should be set</param>
    /// <param name="statusCode"><see cref="int"/> status code of response</param>
    /// <param name="exampleProperties"><see cref="Dictionary{TKey,TValue}"/>? with example properties of response</param>
    /// <typeparam name="TException">Implementation type of <see cref="Exception"/> for response</typeparam>
    /// <returns>Edited <see cref="EndpointSummary"/></returns>
    // public static EndpointSummary SetFailureResponseExample<TException>(this EndpointSummary endpointSummary, int statusCode, Dictionary<string, object>? exampleProperties = null)
    //     where TException : Exception
    // {
    //     endpointSummary.ResponseExamples[statusCode] =
    //         JsonSerializer.Serialize(new FailureResponse("string", "string", typeof(TException).Name, exampleProperties));
    //     return endpointSummary;
    // }
    
    /// <summary>
    /// Sets <see cref="FailureResponse"/> for 400 Bad Request Validation Failures
    /// </summary>
    /// <param name="endpointSummary"><see cref="EndpointSummary"/> where response should be set</param>
    /// <returns>Edited <see cref="EndpointSummary"/></returns>
    // public static EndpointSummary SetValidationResponse(this EndpointSummary endpointSummary)
    // {
    //     endpointSummary.Response<FailureResponse>(StatusCodes.Status400BadRequest, "Validation failure");
    //     return endpointSummary;
    // }


    /// <summary>
    /// Sets <see cref="FailureResponse"/> for 404 Not Found Failures
    /// </summary>
    /// <param name="endpointSummary"><see cref="EndpointSummary"/> where response should be set</param>
    /// <param name="potentialNotFoundEntities"><see cref="string"/>[] array of entity names which should be "not found"</param>
    /// <returns>Edited <see cref="EndpointSummary"/></returns>
    public static EndpointSummary SetNotFoundResponse(this EndpointSummary endpointSummary, params string[] potentialNotFoundEntities)
    {
        potentialNotFoundEntities = potentialNotFoundEntities.Length == 0 ? new[] { "Something" } : potentialNotFoundEntities;

        var responseDescriptionPrefix = potentialNotFoundEntities.Length == 1
            ? potentialNotFoundEntities[0]
            : $"{string.Join(", ", potentialNotFoundEntities[..^1])} or {potentialNotFoundEntities[^1]}";
        
        endpointSummary.Responses[StatusCodes.Status404NotFound] = $"{responseDescriptionPrefix} not found";
        // endpointSummary.SetFailureResponseExample<NotFoundException>(StatusCodes.Status404NotFound);
        
        return endpointSummary;
    }
}
