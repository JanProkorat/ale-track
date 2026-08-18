using AleTrack.Entities;
using AleTrack.Entities.BaseEntities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Moq;
using Moq.EntityFrameworkCore;

namespace AleTrack.Tests.Mocks;

/// <summary>
/// Provides a factory for creating a mocked instance of <see cref="AleTrackDbContext"/>.
/// This class is designed to simplify mocking database interactions for unit testing
/// by allowing pre-defined collections of entities to be set up for various DbSet properties.
/// </summary>
public static class AleTrackDbContextMockFactory
{
    /// <summary>
    /// Creates a mock instance of the AleTrackDbContext preconfigured with the provided entity collections.
    /// </summary>
    /// <param name="clients">The collection of Client entities to include in the mocked DbContext.</param>
    /// <param name="breweries">The collection of Brewery entities to include in the mocked DbContext.</param>
    /// <param name="products">The collection of Product entities to include in the mocked DbContext.</param>
    /// <param name="users">The collection of User entities to include in the mocked DbContext.</param>
    /// <param name="userRoles">The collection of UserRole entities to include in the mocked DbContext.</param>
    /// <param name="orders">The collection of Order entities to include in the mocked DbContext.</param>
    /// <param name="orderItems">The collection of OrderItem entities to include in the mocked DbContext.</param>
    /// <param name="vehicles">The collection of Vehicle entities to include in the mocked DbContext.</param>
    /// <param name="drivers">The collection of Driver entities to include in the mocked DbContext.</param>
    /// <param name="productDeliveries">The collection of ProductDelivery entities to include in the mocked DbContext.</param>
    /// <param name="deliveryItems">The collection of DeliveryItem entities to include in the mocked DbContext.</param>
    /// <param name="inventoryItems">The collection of InventoryItem entities to include in the mocked DbContext.</param>
    /// <param name="clientNotes">The collection of ClientNote entities to include in the mocked DbContext.</param>
    /// <param name="outgoingShipments">The collection of OutgoingShipment entities to include in the mocked DbContext.</param>
    /// <param name="outgoingShipmentInvoices">The collection of OutgoingShipmentInvoice entities to include in the mocked DbContext.</param>
    /// <param name="outgoingShipmentInvoiceLines">The collection of OutgoingShipmentInvoiceLine entities to include in the mocked DbContext.</param>
    /// <param name="refreshTokens">The collection of RefreshToken entities to include in the mocked DbContext.</param>
    /// <param name="clientDeliveryPlaces">The collection of ClientDeliveryPlace entities to include in the mocked DbContext.</param>
    /// <param name="outgoingShipmentStopItems">The collection of OutgoingShipmentStopItem entities to include in the mocked DbContext.</param>
    /// <param name="sales">The collection of Sale entities to include in the mocked DbContext.</param>
    /// <param name="saleItems">The collection of SaleItem entities to include in the mocked DbContext.</param>
    /// <returns>A mock of the AleTrackDbContext configured with the provided entity data.</returns>
    public static Mock<AleTrackDbContext> CreateMock(
        ICollection<Client>? clients = null,
        ICollection<Brewery>? breweries = null,
        ICollection<Product>? products = null,
        ICollection<User>? users = null,
        ICollection<UserRole>? userRoles = null,
        ICollection<Order>? orders = null,
        ICollection<OrderItem>? orderItems = null,
        ICollection<Vehicle>? vehicles = null,
        ICollection<Driver>? drivers = null,
        ICollection<ProductDelivery>? productDeliveries = null,
        ICollection<DeliveryItem>? deliveryItems = null,
        ICollection<InventoryItem>? inventoryItems = null,
        ICollection<ClientNote>? clientNotes = null,
        ICollection<OutgoingShipment>? outgoingShipments = null,
        ICollection<OutgoingShipmentInvoice>? outgoingShipmentInvoices = null,
        ICollection<OutgoingShipmentInvoiceLine>? outgoingShipmentInvoiceLines = null,
        ICollection<OutgoingShipmentPurchaseInvoice>? outgoingShipmentPurchaseInvoices = null,
        ICollection<OutgoingShipmentPurchaseInvoiceLine>? outgoingShipmentPurchaseInvoiceLines = null,
        ICollection<OutgoingShipmentStopItem>? outgoingShipmentStopItems = null,
        ICollection<OutgoingShipmentLoadingState>? outgoingShipmentLoadingStates = null,
        ICollection<RefreshToken>? refreshTokens = null,
        ICollection<ClientDeliveryPlace>? clientDeliveryPlaces = null,
        ICollection<PriceListImport>? priceListImports = null,
        ICollection<Sale>? sales = null,
        ICollection<SaleItem>? saleItems = null,
        ICollection<Supplier>? suppliers = null,
        ICollection<SupplierGood>? supplierGoods = null,
        ICollection<SupplierNote>? supplierNotes = null)
    {
        var dbContextMock = new Mock<AleTrackDbContext>();

        return dbContextMock.SetupDbContextMock(
            clients ?? [],
            breweries ?? [],
            products ?? [],
            users ?? [],
            userRoles ?? [],
            orders ?? [],
            orderItems ?? [],
            vehicles ?? [],
            drivers ?? [],
            productDeliveries ?? [],
            deliveryItems ?? [],
            inventoryItems ?? [],
            clientNotes ?? [],
            outgoingShipments ?? [],
            outgoingShipmentInvoices ?? [],
            outgoingShipmentInvoiceLines ?? [],
            outgoingShipmentPurchaseInvoices ?? [],
            outgoingShipmentPurchaseInvoiceLines ?? [],
            outgoingShipmentStopItems ?? [],
            outgoingShipmentLoadingStates ?? [],
            refreshTokens ?? [],
            clientDeliveryPlaces ?? [],
            priceListImports ?? [],
            sales ?? [],
            saleItems ?? [],
            suppliers ?? [],
            supplierGoods ?? [],
            supplierNotes ?? []);
    }

    /// <summary>
    /// Configures a mock instance of the AleTrackDbContext with the provided collections of entities.
    /// </summary>
    /// <param name="dbContextMock">The mock of AleTrackDbContext to be configured.</param>
    /// <param name="clients">The collection of Client entities to include in the mock.</param>
    /// <param name="breweries">The collection of Brewery entities to include in the mock.</param>
    /// <param name="products">The collection of Product entities to include in the mock.</param>
    /// <param name="users">The collection of User entities to include in the mock.</param>
    /// <param name="userRoles">The collection of UserRole entities to include in the mock.</param>
    /// <param name="orders">The collection of Order entities to include in the mock.</param>
    /// <param name="orderItems">The collection of OrderItem entities to include in the mock.</param>
    /// <param name="vehicles">The collection of Vehicle entities to include in the mock.</param>
    /// <param name="drivers">The collection of Driver entities to include in the mock.</param>
    /// <param name="productDeliveries">The collection of ProductDelivery entities to include in the mock.</param>
    /// <param name="deliveryItems">The collection of DeliveryItem entities to include in the mock.</param>
    /// <param name="inventoryItems">The collection of InventoryItem entities to include in the mock.</param>
    /// <param name="clientNotes">The collection of ClientNote entities to include in the mock.</param>
    /// <returns>A configured mock instance of the AleTrackDbContext with the provided entity data.</returns>
    private static Mock<AleTrackDbContext> SetupDbContextMock(this Mock<AleTrackDbContext> dbContextMock,
        ICollection<Client> clients,
        ICollection<Brewery> breweries,
        ICollection<Product> products,
        ICollection<User> users,
        ICollection<UserRole> userRoles,
        ICollection<Order> orders,
        ICollection<OrderItem> orderItems,
        ICollection<Vehicle> vehicles,
        ICollection<Driver> drivers,
        ICollection<ProductDelivery> productDeliveries,
        ICollection<DeliveryItem> deliveryItems,
        ICollection<InventoryItem> inventoryItems,
        ICollection<ClientNote> clientNotes,
        ICollection<OutgoingShipment> outgoingShipments,
        ICollection<OutgoingShipmentInvoice> outgoingShipmentInvoices,
        ICollection<OutgoingShipmentInvoiceLine> outgoingShipmentInvoiceLines,
        ICollection<OutgoingShipmentPurchaseInvoice> outgoingShipmentPurchaseInvoices,
        ICollection<OutgoingShipmentPurchaseInvoiceLine> outgoingShipmentPurchaseInvoiceLines,
        ICollection<OutgoingShipmentStopItem> outgoingShipmentStopItems,
        ICollection<OutgoingShipmentLoadingState> outgoingShipmentLoadingStates,
        ICollection<RefreshToken> refreshTokens,
        ICollection<ClientDeliveryPlace> clientDeliveryPlaces,
        ICollection<PriceListImport> priceListImports,
        ICollection<Sale> sales,
        ICollection<SaleItem> saleItems,
        ICollection<Supplier> suppliers,
        ICollection<SupplierGood> supplierGoods,
        ICollection<SupplierNote> supplierNotes)
    {
        dbContextMock.Setup<DbSet<Client>>(x => x.Clients).ReturnsDbSet(clients);
        dbContextMock.Setup<DbSet<Brewery>>(x => x.Breweries).ReturnsDbSet(breweries);
        dbContextMock.Setup<DbSet<Product>>(x => x.Products).ReturnsDbSet(products);
        dbContextMock.Setup<DbSet<User>>(x => x.Users).ReturnsDbSet(users);
        dbContextMock.Setup<DbSet<UserRole>>(x => x.UserRoles).ReturnsDbSet(userRoles);
        dbContextMock.Setup<DbSet<Order>>(x => x.Orders).ReturnsDbSet(orders);
        dbContextMock.Setup<DbSet<OrderItem>>(x => x.OrderItems).ReturnsDbSet(orderItems);
        dbContextMock.Setup<DbSet<Vehicle>>(x => x.Vehicles).ReturnsDbSet(vehicles);
        dbContextMock.Setup<DbSet<Driver>>(x => x.Drivers).ReturnsDbSet(drivers);
        dbContextMock.Setup<DbSet<ProductDelivery>>(x => x.ProductDeliveries).ReturnsDbSet(productDeliveries);
        dbContextMock.Setup<DbSet<DeliveryItem>>(x => x.DeliveryItems).ReturnsDbSet(deliveryItems);
        dbContextMock.Setup<DbSet<InventoryItem>>(x => x.InventoryItems).ReturnsDbSet(inventoryItems);
        dbContextMock.Setup<DbSet<ClientNote>>(x => x.ClientNotes).ReturnsDbSet(clientNotes);
        dbContextMock.Setup<DbSet<OutgoingShipment>>(x => x.OutgoingShipments).ReturnsDbSet(outgoingShipments);
        dbContextMock.Setup<DbSet<OutgoingShipmentInvoice>>(x => x.OutgoingShipmentInvoices).ReturnsDbSet(outgoingShipmentInvoices);
        dbContextMock.Setup<DbSet<OutgoingShipmentInvoiceLine>>(x => x.OutgoingShipmentInvoiceLines).ReturnsDbSet(outgoingShipmentInvoiceLines);
        dbContextMock.Setup<DbSet<OutgoingShipmentPurchaseInvoice>>(x => x.OutgoingShipmentPurchaseInvoices).ReturnsDbSet(outgoingShipmentPurchaseInvoices);
        dbContextMock.Setup<DbSet<OutgoingShipmentPurchaseInvoiceLine>>(x => x.OutgoingShipmentPurchaseInvoiceLines).ReturnsDbSet(outgoingShipmentPurchaseInvoiceLines);
        dbContextMock.Setup<DbSet<OutgoingShipmentStopItem>>(x => x.OutgoingShipmentStopItems).ReturnsDbSet(outgoingShipmentStopItems);
        dbContextMock.Setup<DbSet<OutgoingShipmentLoadingState>>(x => x.OutgoingShipmentLoadingStates).ReturnsDbSet(outgoingShipmentLoadingStates);
        dbContextMock.Setup<DbSet<RefreshToken>>(x => x.RefreshTokens).ReturnsDbSet(refreshTokens);
        dbContextMock.Setup<DbSet<ClientDeliveryPlace>>(x => x.ClientDeliveryPlaces).ReturnsDbSet(clientDeliveryPlaces);
        dbContextMock.Setup<DbSet<PriceListImport>>(x => x.PriceListImports).ReturnsDbSet(priceListImports);
        dbContextMock.Setup<DbSet<Sale>>(x => x.Sales).ReturnsDbSet(sales);
        dbContextMock.Setup<DbSet<SaleItem>>(x => x.SaleItems).ReturnsDbSet(saleItems);
        dbContextMock.Setup<DbSet<Supplier>>(x => x.Suppliers).ReturnsDbSet(suppliers);
        dbContextMock.Setup<DbSet<SupplierGood>>(x => x.SupplierGoods).ReturnsDbSet(supplierGoods);
        dbContextMock.Setup<DbSet<SupplierNote>>(x => x.SupplierNotes).ReturnsDbSet(supplierNotes);

        return dbContextMock;
    }
}