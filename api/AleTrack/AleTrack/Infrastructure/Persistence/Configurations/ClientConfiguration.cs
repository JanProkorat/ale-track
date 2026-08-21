using AleTrack.Common.Enums;
using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.OwnsOne(x => x.OfficialAddress, oa =>
        {
            oa.WithOwner();
            oa.OwnsAddressWithPrefix("official_address");
        });

        builder.OwnsOne(x => x.ContactAddress, ca =>
        {
            ca.WithOwner();
            ca.OwnsAddressWithPrefix("contact_address");
        });

        // Restrict rather than cascade: a payer must not be removable while sub-clients still
        // point at it, and soft delete would otherwise leave them pointing at a deleted row.
        builder.HasOne(x => x.InvoicingClient)
            .WithMany(x => x.InvoicedClients)
            .HasForeignKey(x => x.InvoicingClientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.InvoicingClientId);

        // Configure Region with proper sentinel value
        builder.Property(e => e.Region)
            .HasDefaultValue(Region.Other)
            .HasSentinel(Region.Other); // Set sentinel to CLR default value
        
        builder.HasQueryFilter(e => !e.IsDeleted);

    }
}