using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientDeliveryPlaces.Commands.Delete;

/// <summary>
/// Request to delete a client delivery place.
/// </summary>
public record DeleteClientDeliveryPlaceRequest
{
    /// <summary>
    /// ID of the place to delete
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint soft-deleting a client delivery place.
/// </summary>
public sealed class DeleteClientDeliveryPlaceEndpoint(AleTrackDbContext dbContext)
    : Endpoint<DeleteClientDeliveryPlaceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("clients/delivery-places/{Id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteClientDeliveryPlaceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Deletes a client delivery place";
            s.Responses[StatusCodes.Status202Accepted] = "Delivery place deleted";
            s.Responses[StatusCodes.Status404NotFound] = "Delivery place not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteClientDeliveryPlaceRequest req, CancellationToken ct)
    {
        var place = await dbContext.ClientDeliveryPlaces
            .FirstOrDefaultAsync(p => p.PublicId == req.Id && !p.IsDeleted, ct);

        if (place is null)
            ThrowHelper.PublicEntityNotFound(nameof(ClientDeliveryPlace), req.Id);

        // Soft delete: the place leaves every picker but keeps resolving on the
        // shipments that already reference it.
        place!.IsDeleted = true;

        dbContext.ClientDeliveryPlaces.Update(place);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(null, statusCode: StatusCodes.Status202Accepted, cancellation: ct);
    }
}
