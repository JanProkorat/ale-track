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

        // Primátor's builder describes packaging in the superseded shape; resolve it before
        // anything reads a weight off these products. Rows read from a price-list catalogue already
        // carry theirs and are left alone.
        foreach (var brewery in (Brewery[])[svijany, rohozec, primator])
        {
            SeedingProductPackaging.Fill(brewery.Products);
        }

        InsertOperationalData([svijany, rohozec, primator]);

        await dbContext.SaveChangesAsync();
    }

    /// <summary>
    /// Adds only generated history to an already-seeded database, leaving the current-state
    /// fixtures (the Created and InTransit runs, the open orders) untouched. This is the path used
    /// to give an existing environment something for the Reporty module to draw.
    /// </summary>
    public async Task InsertHistoryAsync(DateOnly from, DateOnly to)
    {
        var breweries = await dbContext.Breweries.Include(b => b.Products).ToListAsync();
        var clients = await dbContext.Clients.ToListAsync();
        var vehicles = await dbContext.Vehicles.ToListAsync();
        var drivers = await dbContext.Drivers.ToListAsync();
        var products = breweries.SelectMany(b => b.Products).ToList();

        var history = HistoryBuilder.CreateHistory(
            clients, products, vehicles, drivers, breweries, from, to);

        dbContext.Orders.AddRange(history.Orders);
        dbContext.OutgoingShipments.AddRange(history.Shipments);
        dbContext.ProductDeliveries.AddRange(history.Deliveries);

        await dbContext.SaveChangesAsync();

        Console.WriteLine(
            $"History {from:yyyy-MM-dd}..{to:yyyy-MM-dd}: "
            + $"{history.Shipments.Count} shipments, {history.Orders.Count} orders, "
            + $"{history.Orders.Sum(o => o.OrderItems.Count)} order lines, "
            + $"{history.Orders.Sum(o => o.Returns.Count)} returns, "
            + $"{history.Deliveries.Count} incoming deliveries.");
    }

    /// <summary>
    /// Adds counter-sale history to an already-seeded database, leaving every other module's
    /// data untouched. This is the path used to give an existing environment something for the
    /// Garážový prodej reports to draw.
    /// </summary>
    public async Task InsertSalesHistoryAsync(DateOnly from, DateOnly to)
    {
        var clients = await dbContext.Clients.ToListAsync();
        // The stock rows are what a sale line draws its pieces from, and the line snapshots the
        // product's name, packaging and ceník price — so the product has to come with them.
        var inventory = await dbContext.InventoryItems.Include(i => i.Product).ToListAsync();

        var sales = SaleHistoryBuilder.CreateSales(clients, inventory, from, to);
        dbContext.Sales.AddRange(sales);

        await dbContext.SaveChangesAsync();

        var completed = sales.Where(s => s.State == SaleState.Completed).ToList();
        var unpaid = completed.Count(s => s.Payment == SalePaymentMethod.Invoice && s.Billing?.PaidDate is null);

        Console.WriteLine(
            $"Sales {from:yyyy-MM-dd}..{to:yyyy-MM-dd}: "
            + $"{sales.Count} sales ({completed.Count} completed, {sales.Count - completed.Count} open), "
            + $"{sales.Sum(s => s.Items.Count)} lines, "
            + $"{completed.Sum(s => s.Items.Sum(i => i.Quantity * i.UnitPriceWithVat)):N0} Kč turnover, "
            + $"{unpaid} unpaid invoices.");
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

        // Generated history alongside the current-state fixtures above, so a fresh database has
        // something for the Reporty module to draw. Reuses the same client/vehicle/driver instances
        // rather than rebuilding them, or EF would insert a second copy of each. The window covers
        // the module's widest (180-day) period with headroom; see the historical-seed-data spec.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var history = HistoryBuilder.CreateHistory(
            clients, products, vehicles, drivers, breweries, today.AddDays(-208), today.AddDays(-1));

        dbContext.Orders.AddRange(history.Orders);
        dbContext.OutgoingShipments.AddRange(history.Shipments);
        dbContext.ProductDeliveries.AddRange(history.Deliveries);

        // Counter sales over the same window, so the Garážový prodej reports have a trend too.
        dbContext.Sales.AddRange(
            SaleHistoryBuilder.CreateSales(clients, inventory, today.AddDays(-208), today.AddDays(-1)));
    }

    /// <summary>
    /// Re-attaches the full Svijany product range to an already-seeded brewery, without
    /// rebuilding the rest of the database.
    /// </summary>
    /// <remarks>
    /// Must call every builder <see cref="InsertDataAsync"/> does. It previously skipped
    /// the bottled and keg ranges, which left the dev database with lemonade kegs and no
    /// 15 l size at all — keep this list in sync when a builder is added.
    /// </remarks>
    public async Task InsertProductsToSvijany()
    {
        var svijany = await dbContext.Breweries.FirstAsync(b => b.Name == "Svijany");

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

        // Unlike the catalogue-backed breweries, Primátor's literals still need packaging resolved.
        SeedingProductPackaging.Fill(primator.Products);

        await dbContext.SaveChangesAsync();
    }
}