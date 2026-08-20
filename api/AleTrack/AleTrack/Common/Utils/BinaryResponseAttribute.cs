namespace AleTrack.Common.Utils;

/// <summary>
/// Marks an endpoint whose success response is a file rather than JSON, so
/// <see cref="BinaryResponseProcessor"/> can describe it as binary in the OpenAPI document.
/// </summary>
/// <remarks>
/// Needed because neither <c>Produces(200, contentType)</c> nor <c>Produces&lt;Stream&gt;(...)</c>
/// yields a binary schema on its own: the first leaves the response schema-less, which makes the
/// generated TypeScript client return <c>void</c> and discard the body, and the second makes NSwag
/// emit a <c>Stream</c> object DTO and parse the file as JSON.
/// </remarks>
/// <param name="contentType">MIME type of the file the endpoint returns.</param>
[AttributeUsage(AttributeTargets.Class)]
internal sealed class BinaryResponseAttribute(string contentType) : Attribute
{
    /// <summary>
    /// MIME type of the file the endpoint returns.
    /// </summary>
    public string ContentType { get; } = contentType;
}
