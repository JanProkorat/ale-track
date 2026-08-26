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
    /// Gets the collection of granular per-module user permissions.
    /// </summary>
    public virtual DbSet<UserPermission> UserPermissions => Set<UserPermission>();
    
    /// <summary>
    /// DbSet of <see cref="Order"/>
    /// </summary>
    public virtual DbSet<Order> Orders => Set<Order>();
    
    /// <summary>
    /// DbSet of <see cref="OrderItem"/>
    /// </summary>
    public virtual DbSet<OrderItem> OrderItems => Set<OrderItem>();

    /// <summary>
    /// DbSet of <see cref="OrderSupplierGoodItem"/>
    /// </summary>
    public virtual DbSet<OrderSupplierGoodItem> OrderSupplierGoodItems => Set<OrderSupplierGoodItem>();

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
    /// DbSet of <see cref="Sale"/>
    /// </summary>
    public virtual DbSet<Sale> Sales => Set<Sale>();

    /// <summary>
    /// DbSet of <see cref="SaleItem"/>
    /// </summary>
    public virtual DbSet<SaleItem> SaleItems => Set<SaleItem>();

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
    /// DbSet of <see cref="ClientDeliveryPlace"/>
    /// </summary>
    public virtual DbSet<ClientDeliveryPlace> ClientDeliveryPlaces => Set<ClientDeliveryPlace>();

    /// <summary>
    /// DbSet of <see cref="BreweryNote"/>
    /// </summary>
    public virtual DbSet<BreweryNote> BreweryNotes => Set<BreweryNote>();
    
    /// <summary>
    /// DbSet of <see cref="ClientReminder"/>
    /// </summary>
    public virtual DbSet<ClientReminder> ClientReminders => Set<ClientReminder>();
    
    /// <summary>
    /// DbSet of <see cref="OutgoingShipment"/>
    /// </summary>
    public virtual DbSet<OutgoingShipment> OutgoingShipments => Set<OutgoingShipment>();

    /// <summary>
    /// DbSet of <see cref="OutgoingShipmentInvoice"/>
    /// </summary>
    public virtual DbSet<OutgoingShipmentInvoice> OutgoingShipmentInvoices => Set<OutgoingShipmentInvoice>();

    /// <summary>
    /// DbSet of <see cref="OutgoingShipmentInvoiceLine"/>
    /// </summary>
    public virtual DbSet<OutgoingShipmentInvoiceLine> OutgoingShipmentInvoiceLines => Set<OutgoingShipmentInvoiceLine>();

    /// <summary>
    /// DbSet of <see cref="OutgoingShipmentInvoiceBillingRecipient"/>
    /// </summary>
    public virtual DbSet<OutgoingShipmentInvoiceBillingRecipient> OutgoingShipmentInvoiceBillingRecipients =>
        Set<OutgoingShipmentInvoiceBillingRecipient>();

    /// <summary>
    /// DbSet of <see cref="OutgoingShipmentInvoiceConfirmation"/>
    /// </summary>
    public virtual DbSet<OutgoingShipmentInvoiceConfirmation> OutgoingShipmentInvoiceConfirmations =>
        Set<OutgoingShipmentInvoiceConfirmation>();

    /// <summary>
    /// DbSet of <see cref="OutgoingShipmentPurchaseInvoice"/>
    /// </summary>
    public virtual DbSet<OutgoingShipmentPurchaseInvoice> OutgoingShipmentPurchaseInvoices => Set<OutgoingShipmentPurchaseInvoice>();

    /// <summary>
    /// DbSet of <see cref="OutgoingShipmentPurchaseInvoiceLine"/>
    /// </summary>
    public virtual DbSet<OutgoingShipmentPurchaseInvoiceLine> OutgoingShipmentPurchaseInvoiceLines => Set<OutgoingShipmentPurchaseInvoiceLine>();

    /// <summary>
    /// DbSet of <see cref="OutgoingShipmentLoadingState"/>
    /// </summary>
    public virtual DbSet<OutgoingShipmentLoadingState> OutgoingShipmentLoadingStates => Set<OutgoingShipmentLoadingState>();

    /// <summary>
    /// DbSet of <see cref="OutgoingShipmentStopItem"/>
    /// </summary>
    public virtual DbSet<OutgoingShipmentStopItem> OutgoingShipmentStopItems => Set<OutgoingShipmentStopItem>();

    /// <summary>
    /// DbSet of <see cref="OutgoingShipmentPreparationStep"/>
    /// </summary>
    public virtual DbSet<OutgoingShipmentPreparationStep> OutgoingShipmentPreparationSteps => Set<OutgoingShipmentPreparationStep>();

    /// <summary>
    /// DbSet of <see cref="RefreshToken"/>
    /// </summary>
    public virtual DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    /// <summary>
    /// DbSet of <see cref="PriceListImport"/>
    /// </summary>
    public virtual DbSet<PriceListImport> PriceListImports => Set<PriceListImport>();

    /// <summary>
    /// DbSet of <see cref="RoleCapability"/>
    /// </summary>
    public virtual DbSet<RoleCapability> RoleCapabilities => Set<RoleCapability>();

    /// <summary>
    /// Client-specific product prices
    /// </summary>
    public virtual DbSet<ClientProductPrice> ClientProductPrices => Set<ClientProductPrice>();

    /// <summary>
    /// What happened to a client differently from how it was planned, and what is still open
    /// about it.
    /// </summary>
    public virtual DbSet<ClientLedgerEntry> ClientLedgerEntries => Set<ClientLedgerEntry>();

    /// <summary>
    /// DbSet of <see cref="Supplier"/>
    /// </summary>
    public virtual DbSet<Supplier> Suppliers => Set<Supplier>();

    /// <summary>
    /// DbSet of <see cref="SupplierContact"/>
    /// </summary>
    public virtual DbSet<SupplierContact> SupplierContacts => Set<SupplierContact>();

    /// <summary>
    /// DbSet of <see cref="SupplierOpeningHours"/>
    /// </summary>
    public virtual DbSet<SupplierOpeningHours> SupplierOpeningHours => Set<SupplierOpeningHours>();

    /// <summary>
    /// DbSet of <see cref="SupplierGood"/>
    /// </summary>
    public virtual DbSet<SupplierGood> SupplierGoods => Set<SupplierGood>();

    /// <summary>
    /// DbSet of <see cref="SupplierGoodPrice"/>
    /// </summary>
    public virtual DbSet<SupplierGoodPrice> SupplierGoodPrices => Set<SupplierGoodPrice>();

    /// <summary>
    /// DbSet of <see cref="SupplierNote"/>
    /// </summary>
    public virtual DbSet<SupplierNote> SupplierNotes => Set<SupplierNote>();

    // /// <summary>
    // /// DbSet of <see cref="Ean"/>
    // /// </summary>
    // public virtual DbSet<Ean> Eans => Set<Ean>();

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

     /// <inheritdoc />
    public override int SaveChanges()
    {
        SoftlyDeleteBySettingFlag();
        SoftlyDeleteBySettingEnumState();
        return base.SaveChanges();
    }

    /// <inheritdoc />
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        SoftlyDeleteBySettingFlag();
        SoftlyDeleteBySettingEnumState();
        return base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Softly delete entities implementing <see cref="ISoftlyDeletable"/> by setting their deletion flag
    /// </summary>
    private void SoftlyDeleteBySettingFlag()
    {
        var entries = ChangeTracker
            .Entries()
            .Where(e =>
                e.State == EntityState.Deleted &&
                e.Entity is ISoftlyDeletable)
            .ToList();

        foreach (var entry in entries)
        {
            var entity = (ISoftlyDeletable)entry.Entity;

            entity.IsDeleted = true;

            entry.State = EntityState.Modified;

            KeepOwnedData(entry);
        }
    }

    /// <summary>
    /// Un-deletes the owned entries of an entity that is only being softly deleted.
    /// </summary>
    /// <remarks>
    /// Marking an entity Deleted cascades to its owned types, and an owned type such as
    /// <see cref="Address"/> lives in the owner's own table. Flipping just the owner back to
    /// Modified leaves those owned entries Deleted, so EF writes NULL into their columns in
    /// the very same UPDATE — which the not-null address columns reject with
    /// <c>null value in column "official_address_street_name" violates not-null constraint</c>.
    /// A soft delete keeps the row, so it has to keep the row's owned data with it.
    ///
    /// Only entities loaded into the change tracker are affected, so this deliberately does
    /// not touch child entities in tables of their own (contacts, opening hours, goods):
    /// those are never marked Deleted here, because the owner's DELETE is turned into an
    /// UPDATE before it reaches the database and its FK cascade never fires.
    ///
    /// Not reachable by the unit suite: it mocks <see cref="DbSet{TEntity}"/> through Moq, so
    /// nothing there owns a change tracker to get this wrong. It reproduces against a real
    /// Postgres on any softly deletable entity with an address — <see cref="Client"/> included.
    /// </remarks>
    /// <param name="entry">Entry of the entity being softly deleted.</param>
    private static void KeepOwnedData(EntityEntry entry)
    {
        foreach (var reference in entry.References)
        {
            var target = reference.TargetEntry;

            if (target is null || !target.Metadata.IsOwned() || target.State != EntityState.Deleted)
                continue;

            target.State = EntityState.Unchanged;

            // Owned types can own further owned types.
            KeepOwnedData(target);
        }
    }

    /// <summary>
    /// Softly delete entities implementing <see cref="IEnumSoftlyDeletable"/> by setting their enum state
    /// </summary>
    private void SoftlyDeleteBySettingEnumState()
    {
        var entries = ChangeTracker
            .Entries()
            .Where(e =>
                e.State == EntityState.Deleted &&
                e.Entity is IEnumSoftlyDeletable);

        foreach (var entry in entries)
        {
            var entity = (IEnumSoftlyDeletable)entry.Entity;

            entity.SoftDelete();

            entry.State = EntityState.Modified;
        }
    }
}