using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientDeliveryPlaces.Commands.Update;

/// <summary>
/// Request to update a client delivery place.
/// </summary>
public record UpdateClientDeliveryPlaceRequest
{
    /// <summary>
    /// ID of the place to update
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public SaveClientDeliveryPlaceDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint updating a client delivery place.
/// </summary>
public sealed class UpdateClientDeliveryPlaceEndpoint(AleTrackDbContext dbContext)
    : Endpoint<UpdateClientDeliveryPlaceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/delivery-places/{Id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(UpdateClientDeliveryPlaceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Updates a client delivery place";
            s.Responses[StatusCodes.Status204NoContent] = "Delivery place updated";
            s.Responses[StatusCodes.Status404NotFound] = "Delivery place not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateClientDeliveryPlaceRequest req, CancellationToken ct)
    {
        var place = await dbContext.ClientDeliveryPlaces
            .FirstOrDefaultAsync(p => p.PublicId == req.Id && !p.IsDeleted, ct);

        if (place is null)
            ThrowHelper.PublicEntityNotFound(nameof(ClientDeliveryPlace), req.Id);

        place!.Name = req.Data.Name;
        place.Note = req.Data.Note;
        place.Address = req.Data.ToAddress();

        dbContext.ClientDeliveryPlaces.Update(place);
        await dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
