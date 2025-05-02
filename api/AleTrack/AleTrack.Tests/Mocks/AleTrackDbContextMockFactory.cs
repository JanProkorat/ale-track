using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
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
        ICollection<InventoryItem>? inventoryItems = null)
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
            inventoryItems ?? []);
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
        ICollection<InventoryItem> inventoryItems)
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
        
        return dbContextMock;
    }
}