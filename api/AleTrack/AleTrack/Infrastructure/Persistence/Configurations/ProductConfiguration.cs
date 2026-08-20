using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        // NO global query filter, unlike ClientConfiguration. Product is reached through
        // historical rows — DeliveredLineQuery projects oi.Product.Kind and PackageSize,
        // and ShipmentInvoiceMapper reads item.Product.Name and PriceWithVat. A filter
        // would silently null those Includes for a retired product, zeroing report
        // weights and blanking invoice line names with no error at all. Non-deleted
        // filtering is explicit in the picker and list endpoints instead.
        //
        // Same reasoning, and the same decision, as ClientDeliveryPlaceConfiguration.
    }
}
