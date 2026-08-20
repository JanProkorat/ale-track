using System.Reflection;
using NJsonSchema;
using NSwag;
using NSwag.Generation.Processors;
using NSwag.Generation.Processors.Contexts;

namespace AleTrack.Common.Utils;

/// <summary>
/// Describes the success response of every <see cref="BinaryResponseAttribute"/>-marked endpoint as
/// a binary file, so client generators emit a file download rather than a parsed JSON payload.
/// </summary>
/// <remarks>
/// The frontend's API client is generated from this document (see the repo's CLAUDE.md), so an
/// inaccurate response schema is not cosmetic — it decides whether the client hands back a
/// downloadable blob or silently throws the bytes away.
/// </remarks>
internal sealed class BinaryResponseProcessor : IOperationProcessor
{
    private static readonly string OkStatusCode = StatusCodes.Status200OK.ToString();

    /// <summary>
    /// Content type per marked endpoint, keyed by the endpoint's type name.
    /// </summary>
    /// <remarks>
    /// Matched against the operation ID rather than read off <c>context.MethodInfo</c>, which
    /// FastEndpoints leaves null. Every endpoint here declares
    /// <c>Description(b =&gt; b.WithName(nameof(TheEndpoint)))</c> per the API conventions, and that
    /// name becomes the operation ID — so the type name is the join key.
    /// </remarks>
    private static readonly Dictionary<string, string> ContentTypeByOperationId =
        typeof(BinaryResponseProcessor).Assembly
            .GetTypes()
            .Select(type => (Name: type.Name, Attribute: type.GetCustomAttribute<BinaryResponseAttribute>()))
            .Where(candidate => candidate.Attribute is not null)
            .ToDictionary(
                candidate => candidate.Name,
                candidate => candidate.Attribute!.ContentType,
                StringComparer.Ordinal);

    /// <inheritdoc />
    public bool Process(OperationProcessorContext context)
    {
        var operationId = context.OperationDescription.Operation.OperationId;
        if (operationId is null || !ContentTypeByOperationId.TryGetValue(operationId, out var contentType))
            return true;

        if (!context.OperationDescription.Operation.Responses.TryGetValue(OkStatusCode, out var response))
            return true;

        // Replaced rather than added to: a Produces overload leaves the response either schema-less
        // or carrying an object DTO, and either one gives the generator a JSON branch to prefer.
        response.Content.Clear();
        response.Content.Add(contentType, new OpenApiMediaType
        {
            Schema = new JsonSchema { Type = JsonObjectType.String, Format = "binary" }
        });

        return true;
    }
}
