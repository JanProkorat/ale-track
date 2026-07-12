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
        rohozec.Products.AddRange(RohozecProductsBuilder.GetRohozecKegProducts());
        rohozec.Products.AddRange(RohozecProductsBuilder.GetRohozecBottleProducts());
        rohozec.Products.AddRange(RohozecProductsBuilder.GetRohozecCanProducts());
        dbContext.Breweries.Add(rohozec);
        
        var primator = BreweryBuilder.CreatePrimator();
        primator.Products.AddRange(PrimatorProductsBuilder.GetPrimatorKegProducts());
        primator.Products.AddRange(PrimatorProductsBuilder.GetPrimatorBottleProducts());
        primator.Products.AddRange(PrimatorProductsBuilder.GetPrimatorMultipackProducts());
        primator.Products.AddRange(PrimatorProductsBuilder.GetPrimatorCanProducts());
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

    public async Task InsertProductsToRohozec()
    {
        var rohozec = await dbContext.Breweries.FirstAsync(b => b.Name == "Rohozec");

        rohozec.Products.AddRange(RohozecProductsBuilder.GetRohozecKegProducts());
        rohozec.Products.AddRange(RohozecProductsBuilder.GetRohozecBottleProducts());
        rohozec.Products.AddRange(RohozecProductsBuilder.GetRohozecCanProducts());

        await dbContext.SaveChangesAsync();
    }

    public async Task InsertProductsToPrimator()
    {
        var primator = await dbContext.Breweries.FirstAsync(b => b.Name == "Primátor");
        
        primator.Products.AddRange(PrimatorProductsBuilder.GetPrimatorKegProducts());
        primator.Products.AddRange(PrimatorProductsBuilder.GetPrimatorBottleProducts());
        primator.Products.AddRange(PrimatorProductsBuilder.GetPrimatorMultipackProducts());
        primator.Products.AddRange(PrimatorProductsBuilder.GetPrimatorCanProducts());

        await dbContext.SaveChangesAsync();
    }
}