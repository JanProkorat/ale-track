using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ProductDeliveries.Commands.Delete;

/// <summary>
/// Represents a request to delete a product delivery.
/// </summary>
public sealed record DeleteProductDeliveryRequest
{
    /// <summary>
    /// ID of related delivery
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to handle deletion of a product delivery.
/// </summary>
public sealed class DeleteProductDeliveryEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteProductDeliveryRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("products/deliveries/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .WithName(nameof(DeleteProductDeliveryEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes delivery of brewery products";
                s.Responses[StatusCodes.Status202Accepted] = "Delivery deleted";
                s.SetNotFoundResponse("Delivery");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteProductDeliveryRequest req, CancellationToken ct)
    {
        var delivery = await dbContext.ProductDeliveries.FirstOrDefaultAsync(d => d.PublicId == req.Id, ct);
        if (delivery is null)
            ThrowHelper.PublicEntityNotFound(nameof(ProductDelivery), req.Id);

        dbContext.Remove(delivery!);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(null, StatusCodes.Status202Accepted, ct);
    }
}