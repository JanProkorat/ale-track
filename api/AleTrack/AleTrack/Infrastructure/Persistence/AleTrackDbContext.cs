using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Infrastructure.Persistence;

/// <summary>
/// DbContext for this application
/// </summary>
public class AleTrackDbContext : DbContext
{
    /// <summary>
    /// DbSet of <see cref="Client"/>
    /// </summary>
    public virtual DbSet<Client> Clients => Set<Client>();
    
    /// <summary>
    /// DbSet of <see cref="Brewery"/>
    /// </summary>
    public virtual DbSet<Brewery> Breweries => Set<Brewery>();
    
    /// <summary>
    /// DbSet of <see cref="Product"/>
    /// </summary>
    public virtual DbSet<Product> Products => Set<Product>();

    /// <summary>
    /// DbSet of <see cref="User"/>
    /// </summary>
    public virtual DbSet<User> Users => Set<User>();

    /// <summary>
    /// DbSet of <see cref="UserRole"/>
    /// </summary>
    public virtual DbSet<UserRole> UserRoles => Set<UserRole>();
    
    /// <summary>
    /// DbSet of <see cref="Order"/>
    /// </summary>
    public virtual DbSet<Order> Orders => Set<Order>();
    
    /// <summary>
    /// DbSet of <see cref="OrderItem"/>
    /// </summary>
    public virtual DbSet<OrderItem> OrderItems => Set<OrderItem>();
    
    /// <summary>
    /// DbSet of <see cref="Vehicle"/>
    /// </summary>
    public virtual DbSet<Vehicle> Vehicles => Set<Vehicle>();
    
    /// <summary>
    /// DbSet of <see cref="Driver"/>
    /// </summary>
    public virtual DbSet<Driver> Drivers => Set<Driver>();
    
    /// <summary>
    /// DbSet of <see cref="ProductDelivery"/>
    /// </summary>
    public virtual DbSet<ProductDelivery> ProductDeliveries => Set<ProductDelivery>();
    
    /// <summary>
    /// DbSet of <see cref="DeliveryItem"/>
    /// </summary>
    public virtual DbSet<DeliveryItem> DeliveryItems => Set<DeliveryItem>();
    
    /// <summary>
    /// DbSet of <see cref="InventoryItem"/>
    /// </summary>
    public virtual DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    
    /// <inheritdoc />
    public AleTrackDbContext(){}
    
    /// <inheritdoc />
    public AleTrackDbContext(DbContextOptions<AleTrackDbContext> options)
        : base(options)
    {
    }
    
    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AleTrackDbContext).Assembly);
    }
}