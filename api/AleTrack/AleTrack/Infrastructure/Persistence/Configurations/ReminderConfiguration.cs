using AleTrack.Entities;
using AleTrack.Infrastructure.Converters;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ReminderConfiguration : IEntityTypeConfiguration<Reminder>
{
    public void Configure(EntityTypeBuilder<Reminder> builder)
    {
        builder
            .Property(e => e.DaysOfWeek)
            .HasConversion<DefaultListJsonConverter<DayOfWeek>>();
        
        builder
            .Property(e => e.DaysOfMonth)
            .HasConversion<DefaultListJsonConverter<int>>();
    }
}