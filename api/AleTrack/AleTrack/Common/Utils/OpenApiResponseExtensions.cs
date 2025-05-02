using System.Net.Mime;
using System.Text.Json;
using AleTrack.Common.Models;
using NSwag;

namespace AleTrack.Common.Utils;

/// <summary>
/// Extension methods for <see cref="OpenApiResponse"/>
/// </summary>
internal static class OpenApiResponseExtensions
{
    /// <summary>
    /// Sets <see cref="OpenApiResponse"/> for <see cref="openApiResponse"/>
    /// </summary>
    /// <param name="openApiResponse"><see cref="FailureResponse"/> where <see cref="exampleProperties"/> should be set</param>
    /// <param name="exampleProperties"><see cref="Dictionary{TKey,TValue}"/>? with example properties of response</param>
    /// <typeparam name="TException">Implementation type of <see cref="FailureResponse"/> for response</typeparam>
    /// <returns></returns>
    public static OpenApiResponse SetFailureResponse<TException>(this OpenApiResponse openApiResponse, Dictionary<string, object>? exampleProperties = null)
        where TException : Exception
    {
        openApiResponse.Content[MediaTypeNames.Application.Json] =
            new OpenApiMediaType
            {
                Example = JsonSerializer.Serialize(new FailureResponse("string", "string", exampleProperties))
            };
        return openApiResponse;
    }
}
