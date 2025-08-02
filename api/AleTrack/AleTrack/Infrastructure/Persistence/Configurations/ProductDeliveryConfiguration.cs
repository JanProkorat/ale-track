using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ProductDeliveryConfiguration : IEntityTypeConfiguration<ProductDelivery>
{
    public void Configure(EntityTypeBuilder<ProductDelivery> builder)
    {
        builder.HasMany(pd => pd.Drivers)
            .WithMany(d => d.Deliveries)
            .UsingEntity<Dictionary<string, object>>(
                "product_delivery_drivers",
                j => j
                    .HasOne<Driver>()
                    .WithMany()
                    .HasForeignKey("driver_id")
                    .HasConstraintName("FK_product_delivery_drivers_drivers_driver_id")
                    .OnDelete(DeleteBehavior.Cascade),
                j => j
                    .HasOne<ProductDelivery>()
                    .WithMany()
                    .HasForeignKey("product_delivery_id")
                    .HasConstraintName("FK_product_delivery_drivers_product_deliveries_product_delivery_id")
                    .OnDelete(DeleteBehavior.Cascade),
                j =>
                {
                    j.HasKey("product_delivery_id", "driver_id");
                });
    }
}