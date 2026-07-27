using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientDeliveryPlaces.Queries.List;

/// <summary>
/// Request for a client's delivery places.
/// </summary>
public record GetClientDeliveryPlacesRequest
{
    /// <summary>
    /// ID of the client.
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint returning a client's delivery places.
/// </summary>
public sealed class GetClientDeliveryPlacesEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetClientDeliveryPlacesRequest, List<ClientDeliveryPlaceDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("clients/{id:guid}/delivery-places");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.View)
            .WithName(nameof(GetClientDeliveryPlacesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets a client's delivery places";
            s.Responses[StatusCodes.Status200OK] = "List of delivery places";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientDeliveryPlacesRequest req, CancellationToken ct)
    {
        // Explicit !IsDeleted — the entity deliberately has no global query
        // filter so historical shipments can still resolve removed places.
        //
        // AsNoTracking is mandatory, not an optimization: Address is an owned
        // entity, and `ToDto()` is untranslatable so EF client-evaluates it,
        // which materializes that owned Address. A tracking query cannot track
        // an owned entity whose owner is absent from the result — the
        // projection returns DTOs, not ClientDeliveryPlace — so it throws
        // "owned entities cannot be tracked without their owner". Every sibling
        // endpoint projecting an address via ToDto() is AsNoTracking for this
        // same reason.
        var places = await dbContext.ClientDeliveryPlaces
            .AsNoTracking()
            .Where(p => p.Client.PublicId == req.Id && !p.IsDeleted && !p.Client.IsDeleted)
            .OrderBy(p => p.Name)
            .Select(p => new ClientDeliveryPlaceDto
            {
                Id = p.PublicId,
                Name = p.Name,
                Note = p.Note,
                Address = p.Address.ToDto()
            })
            .ToListAsync(ct);

        await Send.OkAsync(places, cancellation: ct);
    }
}
