using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

/// <summary>
/// Configuration for the Vehicle entity
/// </summary>
public sealed class VehicleConfiguration : IEntityTypeConfiguration<Vehicle>
{
    public void Configure(EntityTypeBuilder<Vehicle> builder)
    {
        // Configure one-to-many relationship between Vehicle and OutgoingShipment
        builder.HasMany(v => v.OutgoingShipments)
               .WithOne(os => os.Vehicle)
               .HasForeignKey(os => os.VehicleId)
               .OnDelete(DeleteBehavior.SetNull);
    }
}