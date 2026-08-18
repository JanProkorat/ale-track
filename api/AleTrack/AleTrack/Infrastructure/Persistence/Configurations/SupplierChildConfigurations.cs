using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

/// <summary>
/// Everything hanging off a <see cref="Supplier"/>. Each child filters through the
/// relationship, the same way <see cref="ClientContactConfiguration"/> does, so a
/// soft-deleted supplier takes its contacts, hours, goods and notes out of every read
/// instead of leaving them reachable through a join.
/// </summary>
public sealed class SupplierContactConfiguration : IEntityTypeConfiguration<SupplierContact>
{
    public void Configure(EntityTypeBuilder<SupplierContact> builder)
    {
        builder.HasQueryFilter(sc => !sc.Supplier.IsDeleted);
    }
}

public sealed class SupplierOpeningHoursConfiguration : IEntityTypeConfiguration<SupplierOpeningHours>
{
    public void Configure(EntityTypeBuilder<SupplierOpeningHours> builder)
    {
        builder.HasQueryFilter(oh => !oh.Supplier.IsDeleted);

        // Every read of the hours is "this supplier's week", and the open/closed answer
        // needs one weekday out of it.
        builder.HasIndex(x => new { x.SupplierId, x.DayOfWeek });
    }
}

public sealed class SupplierGoodConfiguration : IEntityTypeConfiguration<SupplierGood>
{
    public void Configure(EntityTypeBuilder<SupplierGood> builder)
    {
        builder.HasQueryFilter(g => !g.Supplier.IsDeleted);

        builder.HasIndex(x => x.SupplierId);
    }
}

public sealed class SupplierGoodPriceConfiguration : IEntityTypeConfiguration<SupplierGoodPrice>
{
    public void Configure(EntityTypeBuilder<SupplierGoodPrice> builder)
    {
        builder.HasQueryFilter(p => !p.SupplierGood.Supplier.IsDeleted);

        // One price per charge kind per good — the pair is the real key, and the ceník's
        // grouping assumes it holds.
        builder.HasIndex(x => new { x.SupplierGoodId, x.Kind }).IsUnique();
    }
}

public sealed class SupplierNoteConfiguration : IEntityTypeConfiguration<SupplierNote>
{
    public void Configure(EntityTypeBuilder<SupplierNote> builder)
    {
        builder.HasQueryFilter(n => !n.Supplier.IsDeleted);
    }
}
