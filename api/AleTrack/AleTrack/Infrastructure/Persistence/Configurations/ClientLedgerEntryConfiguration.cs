using AleTrack.Common.Enums;
using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ClientLedgerEntryConfiguration : IEntityTypeConfiguration<ClientLedgerEntry>
{
    public void Configure(EntityTypeBuilder<ClientLedgerEntry> builder)
    {
        // Every link except the owning client is SetNull: provenance may be lost, the debt
        // may not. The name snapshots are what keep an orphaned row readable.
        builder.HasOne(e => e.Order)
            .WithMany()
            .HasForeignKey(e => e.OrderId)
            .OnDelete(DeleteBehavior.SetNull);

        // Configured separately from Order above, or EF would have to guess which of the two
        // FKs to this table each navigation belongs to.
        builder.HasOne(e => e.ResolvedByOrder)
            .WithMany()
            .HasForeignKey(e => e.ResolvedByOrderId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Stop)
            .WithMany()
            .HasForeignKey(e => e.StopId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.OrderItem)
            .WithMany()
            .HasForeignKey(e => e.OrderItemId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Product)
            .WithMany()
            .HasForeignKey(e => e.ProductId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.SupplierGoodItem)
            .WithMany()
            .HasForeignKey(e => e.SupplierGoodItemId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.SupplierGood)
            .WithMany()
            .HasForeignKey(e => e.SupplierGoodId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.CustomExtraItem)
            .WithMany()
            .HasForeignKey(e => e.CustomExtraItemId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.OrderReturn)
            .WithMany()
            .HasForeignKey(e => e.OrderReturnId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.CreatedByUser)
            .WithMany()
            .HasForeignKey(e => e.CreatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.ResolvedByUser)
            .WithMany()
            .HasForeignKey(e => e.ResolvedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        // The hottest read there is: it serves both the client profile and the order editor's
        // open-points preview.
        builder.HasIndex(e => new { e.ClientId, e.ResolvedAt });

        // The upsert invariant, enforced where it cannot be raced: at most one unresolved entry
        // per line. The application checks it too, but a check in the application is not an
        // invariant.
        //
        // NULLS NOT DISTINCT is what makes it bite — with Postgres's default, two rows whose
        // line columns are all null count as distinct and the constraint would never fire. The
        // column list is the pairing key the upsert looks the entry up by: a planned line pairs
        // on its own id, a door-side product or supplier good on the product or the good, a
        // door-side return or extra on its free-text name, and an address change on nothing but
        // its order.
        //
        // Money and Other are excluded (targets 5 and 6): they are free rows, not lines, and a
        // client legitimately has several open at once — "owes us 500" and "we owe 300" are two
        // separate things to settle.
        builder.HasIndex(e => new
            {
                e.ClientId,
                e.OrderId,
                e.Target,
                e.OrderItemId,
                e.ProductId,
                e.SupplierGoodItemId,
                e.SupplierGoodId,
                e.CustomExtraItemId,
                e.OrderReturnId,
                e.LineName
            })
            .IsUnique()
            .AreNullsDistinct(false)
            .HasFilter($"""
                        "resolved_at" IS NULL
                        AND "target" NOT IN ({(int)ClientLedgerEntryTarget.Money}, {(int)ClientLedgerEntryTarget.Other})
                        """)
            .HasDatabaseName("IX_client_ledger_entries_open_line");
    }
}
