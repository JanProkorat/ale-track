using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class OutgoingShipmentInvoiceLineConfiguration : IEntityTypeConfiguration<OutgoingShipmentInvoiceLine>
{
    public void Configure(EntityTypeBuilder<OutgoingShipmentInvoiceLine> builder)
    {
        // Deliberately no inverse navigation on OutgoingShipment. Private lines (invoice_id null)
        // would have to be reached through a filtered Include, and EF's navigation fixup ignores
        // the filter predicate: every invoiced line loaded via Invoices.Lines would silently end
        // up in that collection too. The invoicing endpoints load them explicitly instead, see
        // ShipmentInvoiceGraph.LoadAsync.
        builder.HasOne<OutgoingShipment>()
            .WithMany()
            .HasForeignKey(l => l.OutgoingShipmentId)
            .OnDelete(DeleteBehavior.Cascade);

        // IsPrivate duplicates "has no invoice" so the distinction survives in memory, where FKs
        // are not yet assigned. The constraint is what stops the two from ever disagreeing.
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_outgoing_shipment_invoice_lines_private_has_no_invoice",
            """("is_private" AND "invoice_id" IS NULL) OR (NOT "is_private" AND "invoice_id" IS NOT NULL)"""));
    }
}
