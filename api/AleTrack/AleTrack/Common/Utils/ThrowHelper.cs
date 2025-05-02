using AleTrack.Common.Models;

namespace AleTrack.Common.Utils;

/// <summary>
/// Provides utility methods for throwing standardized exceptions in the AleTrack application.
/// This class is designed to streamline the process of throwing exceptions with consistent
/// error details, enhancing error handling and debugging.
/// </summary>
public static class ThrowHelper
{
    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when a public entity with the specified name and ID is not found.
    /// </summary>
    /// <param name="entityName">The name of the entity that was not found.</param>
    /// <param name="publicId">The public identifier of the entity that was not found.</param>
    /// <exception cref="AleTrackException">
    /// Thrown when the specified entity with the given public ID is not found.
    /// Contains additional details such as the entity name and public ID in the exception's error properties.
    /// </exception>
    public static void PublicEntityNotFound(string entityName, Guid publicId)
        => throw new AleTrackException(
            StatusCodes.Status404NotFound,
            ErrorCodes.NotfoundError,
            new Dictionary<string, object>
            {
                { nameof(entityName), entityName },
                { nameof(publicId), publicId }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when multiple public entities with the specified name and IDs are not found.
    /// </summary>
    /// <param name="entityName">The name of the entity for which the public IDs were not found.</param>
    /// <param name="publicIds">A list of public identifiers corresponding to the entities that were not found.</param>
    /// <exception cref="AleTrackException">
    /// Thrown when one or more entities with the given public IDs are not found.
    /// Contains additional details such as the entity name and public IDs in the exception's error properties.
    /// </exception>
    public static void PublicEntitiesNotFound(string entityName, List<Guid> publicIds)
        => throw new AleTrackException(
            StatusCodes.Status404NotFound,
            ErrorCodes.NotfoundError,
            new Dictionary<string, object>
            {
                { nameof(entityName), entityName },
                { nameof(publicIds), publicIds }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when an entity with the specified name and ID already exists.
    /// </summary>
    /// <param name="entityName">The name of the entity that already exists.</param>
    /// <param name="publicId">The public identifier of the entity that already exists.</param>
    /// <exception cref="AleTrackException">
    /// Thrown when an attempt is made to create an entity that already exists with the specified entity name and public ID.
    /// Contains additional details such as the entity name and public ID in the exception's error properties.
    /// </exception>
    public static void EntityAlreadyExists(string entityName, Guid publicId)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.EntityAlreadyExistError,
            new Dictionary<string, object>
            {
                { nameof(entityName), entityName },
                { nameof(publicId), publicId }
            });
}