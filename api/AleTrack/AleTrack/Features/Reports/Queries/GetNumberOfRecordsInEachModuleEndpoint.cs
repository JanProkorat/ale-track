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
        var clientsCountTask = dbContext.Clients.CountAsync(ct);
        var breweriesCountTask = dbContext.Breweries.CountAsync(ct);
        var driversCountTask = dbContext.Drivers.CountAsync(ct);
        var vehiclesCountTask = dbContext.Vehicles.CountAsync(ct);
        var inventoryItemsCountTask = dbContext.InventoryItems.CountAsync(ct);
        var usersCountTask = dbContext.Users.CountAsync(ct);

        await Task.WhenAll(clientsCountTask, breweriesCountTask, driversCountTask, vehiclesCountTask, inventoryItemsCountTask);

        var result = new NumberOfRecordsInEachModuleDto
        {
            ClientsCount = await clientsCountTask,
            BreweriesCount = await breweriesCountTask,
            DriversCount = await driversCountTask,
            VehiclesCount = await vehiclesCountTask,
            InventoryItemsCount = await inventoryItemsCountTask,
            UsersCount = await usersCountTask
        };

        await SendOkAsync(result, ct);
    }
}