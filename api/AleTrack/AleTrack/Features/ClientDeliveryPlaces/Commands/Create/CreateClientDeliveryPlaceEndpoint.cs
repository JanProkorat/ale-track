using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientDeliveryPlaces.Commands.Create;

/// <summary>
/// Request to create a delivery place on a client.
/// </summary>
public record CreateClientDeliveryPlaceRequest
{
    /// <summary>
    /// ID of the client to create the place for
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public SaveClientDeliveryPlaceDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint creating a client delivery place.
/// </summary>
public sealed class CreateClientDeliveryPlaceEndpoint(AleTrackDbContext dbContext)
    : Endpoint<CreateClientDeliveryPlaceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("clients/{id}/delivery-places");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status201Created)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(CreateClientDeliveryPlaceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Creates a client delivery place";
            s.Responses[StatusCodes.Status201Created] = "Delivery place created";
            s.Responses[StatusCodes.Status404NotFound] = "Client not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateClientDeliveryPlaceRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .Include(c => c.DeliveryPlaces)
            .FirstOrDefaultAsync(c => c.PublicId == req.Id, ct);

        if (client is null)
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.Id);

        var place = new ClientDeliveryPlace
        {
            Client = client!,
            Name = req.Data.Name,
            Note = req.Data.Note,
            Address = req.Data.ToAddress()
        };

        client!.DeliveryPlaces.Add(place);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(place.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}
