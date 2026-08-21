using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class OutgoingShipmentInvoiceBillingRecipientConfiguration
    : IEntityTypeConfiguration<OutgoingShipmentInvoiceBillingRecipient>
{
    public void Configure(EntityTypeBuilder<OutgoingShipmentInvoiceBillingRecipient> builder)
    {
        builder.HasOne(r => r.Invoice)
            .WithMany(i => i.BillingRecipients)
            .HasForeignKey(r => r.InvoiceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Same as the invoice's own client FK: deleting a client must not take invoice history
        // with it.
        builder.HasOne(r => r.Client)
            .WithMany()
            .HasForeignKey(r => r.ClientId)
            .OnDelete(DeleteBehavior.NoAction);

        // Only one address on the row, but it is a copy of the client's *official* one, so the
        // columns say which.
        builder.OwnsOne(r => r.Address, a =>
        {
            a.WithOwner();
            a.OwnsAddressWithPrefix("official_address");
        });

        builder.Navigation(r => r.Address).IsRequired();
    }
}
