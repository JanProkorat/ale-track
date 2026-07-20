using AleTrack.Common.Enums;
using AleTrack.Entities;
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

        InsertOperationalData([svijany, rohozec, primator]);

        await dbContext.SaveChangesAsync();
    }

    /// <summary>
    /// Seeds demo operational data (clients, vehicles, drivers, inventory, orders,
    /// outgoing shipments and incoming deliveries) referencing the freshly-built
    /// breweries/products, so every module has representative data to work with.
    /// </summary>
    private void InsertOperationalData(IReadOnlyList<Brewery> breweries)
    {
        var products = breweries.SelectMany(b => b.Products).ToList();

        var vehicles = OperationalDataBuilder.CreateVehicles();
        var drivers = OperationalDataBuilder.CreateDrivers();
        var clients = ClientBuilder.GetSampleClients();
        var inventory = OperationalDataBuilder.CreateInventory(products);
        dbContext.Vehicles.AddRange(vehicles);
        dbContext.Drivers.AddRange(drivers);
        dbContext.Clients.AddRange(clients);
        dbContext.InventoryItems.AddRange(inventory);

        var orders = OperationalDataBuilder.CreateOrders(clients, products);
        dbContext.Orders.AddRange(orders);

        // Two historical (completed) standalone orders.
        foreach (var finished in orders.TakeLast(2))
        {
            finished.State = OrderState.Finished;
            finished.ActualDeliveryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-3));
        }

        // Shipment A (Created) takes the first 3 orders + a from-stock dokládka.
        var dokladkaProduct = inventory[0].Product!;
        var shipmentA = OperationalDataBuilder.CreateShipmentCreated(
            "Vývoz Žitava – pondělí", orders.Take(3).ToList(), vehicles[0], drivers.Take(2).ToList(), dokladkaProduct);

        // Shipment B (InTransit) takes the next 2 orders.
        var shipmentB = OperationalDataBuilder.CreateShipmentInTransit(
            "Vývoz Žitava – úterý", orders.Skip(3).Take(2).ToList(), vehicles[1], drivers.Skip(2).Take(1).ToList());

        dbContext.OutgoingShipments.AddRange(shipmentA, shipmentB);

        var deliveries = OperationalDataBuilder.CreateDeliveries(breweries, products, vehicles, drivers);
        dbContext.ProductDeliveries.AddRange(deliveries);
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