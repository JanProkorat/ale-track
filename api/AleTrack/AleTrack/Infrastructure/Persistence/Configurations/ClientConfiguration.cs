using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.ToTable("clients");
        builder.HasKey(x => x.Id);
        
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
    }
}