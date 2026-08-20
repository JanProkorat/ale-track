using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> builder)
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

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
