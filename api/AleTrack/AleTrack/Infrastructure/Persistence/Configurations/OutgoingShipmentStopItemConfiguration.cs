using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class OutgoingShipmentStopItemConfiguration : IEntityTypeConfiguration<OutgoingShipmentStopItem>
{
    public void Configure(EntityTypeBuilder<OutgoingShipmentStopItem> builder)
    {
        // The stop owns these rows: they die with it, and they are rebuilt on every transition
        // into Loaded. Cascade is right here in a way it deliberately is not for the two
        // provenance links, which are SET NULL.
        builder.HasOne(i => i.Stop)
            .WithMany(s => s.Items)
            .HasForeignKey(i => i.StopId)
            .OnDelete(DeleteBehavior.Cascade);

        // Every report query filters by shipment state and delivery date, then aggregates per
        // stop, so this is the access path that matters.
        builder.HasIndex(i => i.StopId);
    }
}
