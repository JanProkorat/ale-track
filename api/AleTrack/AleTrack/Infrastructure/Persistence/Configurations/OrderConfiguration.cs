using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder
            .HasOne(o => o.OutgoingShipmentStop)
            .WithOne(s => s.ClientOrder)
            .HasForeignKey<Order>(o => o.OutgoingShipmentStopId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}