using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

internal sealed class DriverConfiguration : IEntityTypeConfiguration<Driver>
{
    public void Configure(EntityTypeBuilder<Driver> builder)
    {
        builder.HasMany(x => x.Deliveries)
            .WithMany(x => x.Drivers);

        // Deleting an account releases the driver record rather than removing a person
        // from the fleet. Unique because one account maps to at most one driver; Postgres
        // treats NULLs as distinct, so unlinked drivers do not collide.
        builder.HasOne(x => x.User)
            .WithOne()
            .HasForeignKey<Driver>(x => x.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(x => x.UserId).IsUnique();
    }
}