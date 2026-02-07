using AleTrack.Infrastructure.Persistence;
using AleTrack.Seeding.Builders;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Seeding;

/// <summary>
/// Service to insert data into the database
/// </summary>
internal sealed class SeedingService(AleTrackDbContext dbContext)
{
    public async Task InsertDataAsync()
    {
        var svijany = BreweryBuilder.CreateSvijany();
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleBottledProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleKegProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleLimoKegProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleMultipackProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleCanZeroPointFiveProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleCanZeroPointThreeProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleTwoLiterCanProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleFiveLiterKegProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleDecorativeBottleProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleDuoPackProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleOtherProducts());
        dbContext.Breweries.Add(svijany);
        
        var rohozec = BreweryBuilder.CreateRohozec();
        dbContext.Breweries.Add(rohozec);
        
        var primator = BreweryBuilder.CreatePrimator();
        dbContext.Breweries.Add(primator);
        
        await dbContext.SaveChangesAsync();
    }

    public async Task InsertProductsToSvijany()
    {
        var svijany = await dbContext.Breweries.FirstAsync(b => b.Name == "Svijany");
        
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleLimoKegProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleMultipackProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleCanZeroPointFiveProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleCanZeroPointThreeProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleTwoLiterCanProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleFiveLiterKegProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleDecorativeBottleProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleDuoPackProducts());
        svijany.Products.AddRange(SvijanyProductsBuilder.GetSampleOtherProducts());
        
        await dbContext.SaveChangesAsync();
    }
}