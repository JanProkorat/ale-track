using System.Diagnostics.CodeAnalysis;
using AleTrack.Common.Enums;
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
    [DoesNotReturn]
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
    [DoesNotReturn]
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
    [DoesNotReturn]
    public static void EntityAlreadyExists(string entityName, Guid publicId)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.EntityAlreadyExistError,
            new Dictionary<string, object>
            {
                { nameof(entityName), entityName },
                { nameof(publicId), publicId }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> to represent a bad request error with a provided message.
    /// </summary>
    /// <param name="message">The detailed error message describing the bad request.</param>
    /// <exception cref="AleTrackException">
    /// Thrown to indicate a bad request error with a status code of 400 and an error code of "BAD_REQUEST_ERROR".
    /// Includes the provided message in the exception's error properties.
    /// </exception>
    [DoesNotReturn]
    public static void BadRequest(string message)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.BadRequestError,
            new Dictionary<string, object>
            {
                { "message", message }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when the price list being applied is not the one
    /// the caller previewed.
    /// </summary>
    /// <param name="expected">Hash the caller says it reviewed.</param>
    /// <param name="actual">Hash of the file it actually sent.</param>
    /// <exception cref="AleTrackException">
    /// Thrown with 409 Conflict. Applying a file other than the reviewed one would write prices
    /// nobody approved, so it is refused rather than reconciled.
    /// </exception>
    [DoesNotReturn]
    public static void PriceListSourceChanged(string expected, string actual)
        => throw new AleTrackException(
            StatusCodes.Status409Conflict,
            ErrorCodes.PriceListSourceChanged,
            new Dictionary<string, object>
            {
                { nameof(expected), expected },
                { nameof(actual), actual }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when an uploaded price list cannot be read.
    /// </summary>
    /// <param name="errors">Every reason the file was rejected, so one upload reports them all.</param>
    /// <exception cref="AleTrackException">Thrown with 400 Bad Request.</exception>
    [DoesNotReturn]
    public static void PriceListUnreadable(IReadOnlyCollection<object> errors)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.PriceListUnreadable,
            new Dictionary<string, object>
            {
                { nameof(errors), errors }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when an order is already assigned to an outgoing shipment.
    /// </summary>
    /// <param name="orderIds">Ids of the orders that are already assigned to an outgoing shipment.</param>
    /// <exception cref="AleTrackException"></exception>
    [DoesNotReturn]
    public static void OrderAlreadyAssignedToOutgoingShipment(List<Guid> orderIds)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.OrderAlreadyAssignedToOutgoingShipment,
            new Dictionary<string, object>
            {
                { nameof(orderIds), orderIds }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when an outgoing shipment is not in the required prepared state.
    /// </summary>
    /// <param name="state">The current state of the outgoing shipment that caused the error.</param>
    /// <exception cref="AleTrackException">
    /// Thrown to indicate that the shipment is not prepared, with a status code of 400 and an error code of "SHIPMENT_NOT_PREPARED".
    /// Includes the provided shipment state in the exception's error properties.
    /// </exception>
    [DoesNotReturn]
    public static void ShipmentNotPrepared(OutgoingShipmentState state)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.ShipmentNotPrepared,
            new Dictionary<string, object>
            {
                { nameof(state), state }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when an outgoing shipment cannot be marked as loaded without any stops.
    /// </summary>
    /// <exception cref="AleTrackException"></exception>
    [DoesNotReturn]
    public static void ShipmentCannotBeLoadedWithoutStops()
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.ShipmentCannotBeLoadedWithoutStops);

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when an outgoing shipment cannot be deleted because it has already been delivered.
    /// </summary>
    /// <param name="shipmentId">ID of the outgoing shipment</param>
    /// <exception cref="AleTrackException"></exception>
    [DoesNotReturn]
    public static void ShipmentAlreadyDeliveredCannotBeDeleted(Guid shipmentId)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.ShipmentAlreadyDelivered,
            new Dictionary<string, object>
            {
                { nameof(shipmentId), shipmentId }
            });

    [DoesNotReturn]
    public static void ShipmentAlreadyCancelled(Guid shipmentId)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.ShipmentAlreadyCancelled,
            new Dictionary<string, object>
            {
                { nameof(shipmentId), shipmentId }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when a brewery still owns products and so
    /// cannot be deleted.
    /// </summary>
    /// <param name="breweryId">ID of the brewery</param>
    /// <param name="productCount">How many products still belong to it</param>
    /// <remarks>
    /// order_items.product_id is Restrict, so letting the delete through would surface as a
    /// raw DbUpdateException. Refusing on any product at all — rather than only products
    /// with history — keeps the outcome predictable and avoids a partial cascade that
    /// removes the unused products and then fails on the used ones.
    /// </remarks>
    /// <exception cref="AleTrackException"></exception>
    [DoesNotReturn]
    public static void BreweryHasProducts(Guid breweryId, int productCount)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.BreweryHasProducts,
            new Dictionary<string, object>
            {
                { nameof(breweryId), breweryId },
                { nameof(productCount), productCount }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when a shipment state transition is not
    /// permitted from the shipment's current state.
    /// </summary>
    /// <param name="from">The shipment's current state</param>
    /// <param name="to">The requested state</param>
    /// <exception cref="AleTrackException"></exception>
    [DoesNotReturn]
    public static void ShipmentTransitionNotAllowed(OutgoingShipmentState from, OutgoingShipmentState to)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.ShipmentTransitionNotAllowed,
            new Dictionary<string, object>
            {
                { nameof(from), from },
                { nameof(to), to }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when an update would change content that
    /// froze when the shipment left <see cref="OutgoingShipmentState.Created"/>.
    /// </summary>
    /// <param name="state">The shipment's current state</param>
    /// <param name="fields">Names of the frozen fields the request would have changed</param>
    /// <exception cref="AleTrackException"></exception>
    [DoesNotReturn]
    public static void ShipmentContentFrozen(OutgoingShipmentState state, IReadOnlyCollection<string> fields)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.ShipmentContentFrozen,
            new Dictionary<string, object>
            {
                { nameof(state), state },
                { nameof(fields), fields }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when an update would change the content of
    /// an order that is closed, or already loaded onto a shipment.
    /// </summary>
    /// <param name="orderId">ID of the order</param>
    /// <exception cref="AleTrackException"></exception>
    [DoesNotReturn]
    public static void OrderContentFrozen(Guid orderId)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.OrderContentFrozen,
            new Dictionary<string, object>
            {
                { nameof(orderId), orderId }
            });

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when a driver account attempts an operation
    /// reserved for office staff — creating or deleting driver records and shipments.
    /// </summary>
    /// <exception cref="AleTrackException">Thrown with 403 Forbidden.</exception>
    /// <remarks>
    /// Deliberately 403 rather than 404: these routes take no id whose existence could leak,
    /// and the caller is being told the operation itself is not theirs.
    /// </remarks>
    [DoesNotReturn]
    public static void DriverScopeForbidden()
        => throw new AleTrackException(
            StatusCodes.Status403Forbidden,
            ErrorCodes.DriverScopeForbidden);

    /// <summary>
    /// Throws an <see cref="AleTrackException"/> when a driver record is already linked to a
    /// different user account.
    /// </summary>
    /// <param name="driverId">Public id of the driver already linked elsewhere.</param>
    /// <exception cref="AleTrackException">Thrown with 400 Bad Request.</exception>
    [DoesNotReturn]
    public static void DriverAlreadyLinkedToUser(Guid driverId)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ErrorCodes.DriverAlreadyLinkedToUser,
            new Dictionary<string, object>
            {
                { nameof(driverId), driverId }
            });
}