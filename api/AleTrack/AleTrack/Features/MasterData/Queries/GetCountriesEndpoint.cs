using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using FastEndpoints;

namespace AleTrack.Features.MasterData.Queries;

/// <summary>
/// Endpoint to get list of countries for dropdowns
/// </summary>
public sealed class GetCountriesEndpoint : EndpointWithoutRequest<List<Country>>
{
    public override void Configure()
    {
        Get("master-data/countries");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetCountriesEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets countries list";
            s.Responses[StatusCodes.Status200OK] = "List of countries";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var data = Enum.GetValues<Country>().ToList();
        await SendAsync(data, cancellation: ct);
    }
}