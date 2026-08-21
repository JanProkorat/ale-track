using AleTrack.Common.Enums;

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

    /// <summary>
    /// Trading name of the client. Two clients may share a <see cref="Name"/>, and this is
    /// what tells them apart in a picker.
    /// </summary>
    public string? BusinessName { get; set; }

    /// <summary>
    /// Related region of the client.
    /// </summary>
    public Region Region { get; set; }
}