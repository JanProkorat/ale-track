using AleTrack.Entities;
using AleTrack.Infrastructure.Converters;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ClientReminderConfiguration : IEntityTypeConfiguration<ClientReminder>
{
    public void Configure(EntityTypeBuilder<ClientReminder> builder)
    {
        // Configure properties with value converters and comparers
        builder
            .Property(e => e.DaysOfWeek)
            .HasConversion<DefaultListJsonConverter<DayOfWeek>>()
            .Metadata.SetValueComparer(new ValueComparer<List<DayOfWeek>>(
                (c1, c2) => c1!.SequenceEqual(c2!),
                c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                c => c.ToList()));
        
        builder
            .Property(e => e.DaysOfMonth)
            .HasConversion<DefaultListJsonConverter<int>>()
            .Metadata.SetValueComparer(new ValueComparer<List<int>>(
                (c1, c2) => c1!.SequenceEqual(c2!),
                c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                c => c.ToList()));

        // Global query filter for all reminder types
        // For ClientReminder: filter out reminders of soft-deleted clients
        builder.HasQueryFilter(r => !r.Client.IsDeleted);
    }
}