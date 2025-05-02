namespace AleTrack.Features.Clients.Queries.List;

/// <summary>
/// Represents a data transfer object for a client item in the list.
/// Contains basic information about a client.
/// </summary>
public sealed class ClientListItemDto
{
    /// <summary>
    /// Unique identifier of the client.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name of the client.
    /// </summary>
    public string Name { get; set; } = null!;
}