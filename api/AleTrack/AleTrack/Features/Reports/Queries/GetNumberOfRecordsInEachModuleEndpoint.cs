using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reports.Queries;

public sealed class GetNumberOfRecordsInEachModuleEndpoint(AleTrackDbContext dbContext) : EndpointWithoutRequest<NumberOfRecordsInEachModuleDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/number-of-records-in-each-module");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetNumberOfRecordsInEachModuleEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets number of records in each module";
            s.Responses[StatusCodes.Status200OK] = "Dto with number of records in each module";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var result = new NumberOfRecordsInEachModuleDto
        {
            ClientsCount = await dbContext.Clients.CountAsync(ct),
            BreweriesCount = await dbContext.Breweries.CountAsync(ct),
            DriversCount = await dbContext.Drivers.CountAsync(ct),
            VehiclesCount = await dbContext.Vehicles.CountAsync(ct),
            InventoryItemsCount = await dbContext.InventoryItems.CountAsync(ct),
            UsersCount = await dbContext.Users.CountAsync(ct)
        };

        await SendOkAsync(result, ct);
    }
}