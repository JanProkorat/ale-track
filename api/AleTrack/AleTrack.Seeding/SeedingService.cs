using AleTrack.Infrastructure.Persistence;
using AleTrack.Seeding.Builders;

namespace AleTrack.Seeding;

/// <summary>
/// Service to insert data into the database
/// </summary>
internal sealed class SeedingService(AleTrackDbContext dbContext)
{
    public async Task InsertDataAsync()
    {
        var svijany = BreweryBuilder.CreateSvijany();
        svijany.Products.AddRange(ProductsBuilder.GetSampleBottledProducts());
        svijany.Products.AddRange(ProductsBuilder.GetSampleKegProducts());
        
        dbContext.Breweries.Add(svijany);
        await dbContext.SaveChangesAsync();
    }
}