using AleTrack.Common.Enums;
using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ClientDeliveryPlaceConfiguration : IEntityTypeConfiguration<ClientDeliveryPlace>
{
    public void Configure(EntityTypeBuilder<ClientDeliveryPlace> builder)
    {
        // Only one address on the row, so the columns keep Address's own names —
        // OwnsAddressWithPrefix exists for entities holding two of them.
        builder.OwnsOne(x => x.Address, a =>
        {
            a.WithOwner();

            // A place picked straight off the map has no postal parts. Fluent
            // config wins over the [Required] attributes on the shared Address
            // type, which stays untouched.
            a.Property(x => x.StreetName).IsRequired(false);
            a.Property(x => x.StreetNumber).IsRequired(false);
            a.Property(x => x.City).IsRequired(false);
            a.Property(x => x.Zip).IsRequired(false);

            // A place always comes from a map pick or a geocoded hit, so it is
            // always plottable — no fallback point is ever needed.
            a.Property(x => x.Latitude).IsRequired();
            a.Property(x => x.Longitude).IsRequired();

            // Country's enum starts at 1, so CLR default 0 is not a valid value.
            a.Property(x => x.Country)
                .HasDefaultValue(Country.Czechia)
                .HasSentinel(default(Country));
        });

        // NO global query filter here, unlike ClientNoteConfiguration. One would
        // silently null out the Include when the shipment detail loads a stop
        // pointing at a soft-deleted place — the address would vanish from
        // history with no error. Non-deleted filtering is explicit in the list
        // endpoint instead.
    }
}
