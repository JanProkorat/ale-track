using AleTrack.Entities;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

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
    
    /// <summary>
    /// DbSet of <see cref="ExchangeRate"/>
    /// </summary>
    public virtual DbSet<ExchangeRate> ExchangeRates => Set<ExchangeRate>();
    
    /// <summary>
    /// DbSet of <see cref="BreweryReminder"/>
    /// </summary>
    public virtual DbSet<BreweryReminder> BreweryReminders => Set<BreweryReminder>();
    
    /// <summary>
    /// DbSet of <see cref="ClientContact"/>
    /// </summary>
    public virtual DbSet<ClientContact> ClientContacts => Set<ClientContact>();
    
    /// <summary>
    /// DbSet of <see cref="ClientNote"/>
    /// </summary>
    public virtual DbSet<ClientNote> ClientNotes => Set<ClientNote>();
    
    /// <summary>
    /// DbSet of <see cref="ClientReminder"/>
    /// </summary>
    public virtual DbSet<ClientReminder> ClientReminders => Set<ClientReminder>();
    
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

    /// <summary>
    /// Softly delete the selected entity if it is not softly deleted already
    /// </summary>
    /// <param name="entity">Entity, which should be softly deleted</param>
    /// <typeparam name="TEntity">type of softly deleted entity</typeparam>
    /// <returns><see cref="EntityEntry"/> with generic type of softly deleted entity</returns>
    public virtual EntityEntry<TEntity> SoftlyDelete<TEntity>(TEntity entity) where TEntity : class, ISoftlyDeletable
    {
        if (entity.IsDeleted)
            return Entry(entity);
        
        entity.IsDeleted = true;

        Attach(entity);
        var entityEntry = Entry(entity);
        entityEntry.Property(e => e.IsDeleted).IsModified = true;
        
        return entityEntry;
    }
}