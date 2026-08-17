using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Seeding.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Builders;

/// <summary>
/// Guards the invariants the Garážový prodej reports depend on. Every one of these corresponds
/// to a branch of a report query — break it and a card silently renders empty or zeroed rather
/// than failing, which is exactly what makes seed data hard to trust.
/// </summary>
public sealed class SaleHistoryBuilderTests
{
    private static readonly DateOnly From = new(2026, 1, 21);
    private static readonly DateOnly To = new(2026, 8, 16);

    private static List<Client> Clients() =>
    [
        new() { Id = 1, PublicId = Guid.NewGuid(), Name = "Hospoda U Kotvy" },
        new() { Id = 2, PublicId = Guid.NewGuid(), Name = "Restaurace Na Rynku" },
        new() { Id = 3, PublicId = Guid.NewGuid(), Name = "Pivnice Na Rohu" },
    ];

    /// <summary>Twelve stock rows, priced and packaged, plus one with no product behind it.</summary>
    private static List<InventoryItem> Inventory()
    {
        var items = Enumerable.Range(1, 12)
            .Select(i => new InventoryItem
            {
                Id = i,
                PublicId = Guid.NewGuid(),
                Quantity = 10 + i,
                Product = new Product
                {
                    Id = i,
                    PublicId = Guid.NewGuid(),
                    Name = $"Produkt {i}",
                    Kind = i % 2 == 0 ? ProductKind.Keg : ProductKind.Can,
                    PackageSize = i % 2 == 0 ? 50 : 0.5,
                    PriceWithVat = 100m + i * 10,
                },
            })
            .ToList();

        // A free-form stock row: sellable at the counter, but with no ceník price to snapshot.
        items.Add(new InventoryItem { Id = 99, PublicId = Guid.NewGuid(), Name = "Vratná basa", Quantity = 40 });

        return items;
    }

    private static List<Sale> Build(DateOnly? from = null, DateOnly? to = null) =>
        SaleHistoryBuilder.CreateSales(Clients(), Inventory(), from ?? From, to ?? To);

    [Fact]
    public void CreateSales_IsDeterministic()
    {
        var first = Build();
        var second = Build();

        // Same seed, same window — a changed generator should surface here, not as silently
        // different dev data.
        second.Count.Should().Be(first.Count);
        second.Sum(s => s.Items.Count).Should().Be(first.Sum(s => s.Items.Count));
        second.Sum(s => s.Items.Sum(i => i.Quantity * i.UnitPriceWithVat))
            .Should().Be(first.Sum(s => s.Items.Sum(i => i.Quantity * i.UnitPriceWithVat)));
    }

    [Fact]
    public void CreateSales_CoversTheWholeWindow()
    {
        var sales = Build();

        sales.Should().NotBeEmpty();
        sales.Should().OnlyContain(s => s.SaleDate >= From && s.SaleDate <= To);

        // Every 30-day slice has sales, so the shortest period preset is never empty.
        for (var start = From; start < To; start = start.AddDays(30))
        {
            var end = start.AddDays(30);
            sales.Should().Contain(s => s.SaleDate >= start && s.SaleDate < end);
        }
    }

    [Fact]
    public void CreateSales_ProducesBothPaymentMethods()
    {
        var completed = Build().Where(s => s.State == SaleState.Completed).ToList();

        completed.Should().Contain(s => s.Payment == SalePaymentMethod.Cash);
        completed.Should().Contain(s => s.Payment == SalePaymentMethod.Invoice);
    }

    [Fact]
    public void CreateSales_LeavesSomeInvoicesUnpaidAndOverdue()
    {
        var invoices = Build()
            .Where(s => s.State == SaleState.Completed && s.Payment == SalePaymentMethod.Invoice)
            .ToList();

        invoices.Should().Contain(s => s.Billing!.PaidDate != null);

        var unpaid = invoices.Where(s => s.Billing!.PaidDate is null).ToList();
        unpaid.Should().NotBeEmpty();

        // The outstanding list is worth looking at only if something on it is actually late.
        unpaid.Should().Contain(s => s.Billing!.DueDate < To);
    }

    [Fact]
    public void CreateSales_ProducesBothBuyerKindsIncludingAnonymousWalkins()
    {
        var sales = Build();

        sales.Should().Contain(s => s.BuyerKind == SaleBuyerKind.Client && s.Client != null);
        sales.Should().Contain(s => s.BuyerKind == SaleBuyerKind.Walkin && s.BuyerName != null);
        // An anonymous cash sale names nobody — the Kupující tab must handle it.
        sales.Should().Contain(s => s.BuyerKind == SaleBuyerKind.Walkin && s.BuyerName == null);
    }

    [Fact]
    public void CreateSales_ProducesEveryPricingBranch()
    {
        var lines = Build().SelectMany(s => s.Items).ToList();

        lines.Should().Contain(i => i.ListPriceWithVat > i.UnitPriceWithVat, "discounts drive the Slevy card");
        lines.Should().Contain(i => i.ListPriceWithVat == i.UnitPriceWithVat, "most sales are at list price");
        // A surcharge must not offset real discounts — the report clamps it at zero, so the data
        // has to contain one for that clamp to mean anything.
        lines.Should().Contain(i => i.ListPriceWithVat < i.UnitPriceWithVat);
        // Free-form stock has no ceník entry, so it carries no list price at all.
        lines.Should().Contain(i => i.ListPriceWithVat == null && i.ProductId == null && i.Product == null);
    }

    [Fact]
    public void CreateSales_LeavesPartOfTheWarehouseUnsold()
    {
        var soldFrom = Build()
            .SelectMany(s => s.Items)
            .Where(i => i.InventoryItem is not null)
            .Select(i => i.InventoryItem!.Id)
            .ToHashSet();

        // The dead-stock rows the Zboží tab exists to surface: in stock, never sold.
        Inventory().Should().Contain(item => !soldFrom.Contains(item.Id));
        soldFrom.Should().NotBeEmpty();
    }

    [Fact]
    public void CreateSales_LeavesOpenSalesForTheDashboardCard()
    {
        var sales = Build();

        sales.Should().Contain(s => s.State == SaleState.Draft);
        sales.Should().Contain(s => s.State == SaleState.AwaitingPayment);

        // Open sales are recent — a draft from six months ago would be noise, not a to-do.
        sales.Where(s => s.State != SaleState.Completed)
            .Should().OnlyContain(s => s.SaleDate > To.AddDays(-14));
    }

    [Fact]
    public void CreateSales_CompletedSalesCarryACompletionTimestamp()
    {
        var sales = Build();

        sales.Where(s => s.State == SaleState.Completed).Should().OnlyContain(s => s.CompletedAt != null);
        // A draft has not been handed over, so nothing has been completed yet.
        sales.Where(s => s.State == SaleState.Draft).Should().OnlyContain(s => s.CompletedAt == null);
    }

    [Fact]
    public void CreateSales_WithoutClients_Throws()
    {
        var act = () => SaleHistoryBuilder.CreateSales([], Inventory(), From, To);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void CreateSales_WithoutPricedStock_Throws()
    {
        // Only a free-form row: nothing carrying a price or packaging to snapshot onto a line.
        var stockWithoutProducts = new List<InventoryItem>
        {
            new() { Id = 1, PublicId = Guid.NewGuid(), Name = "Vratná basa", Quantity = 5 },
        };

        var act = () => SaleHistoryBuilder.CreateSales(Clients(), stockWithoutProducts, From, To);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void CreateSales_WithInvertedWindow_Throws()
    {
        var act = () => SaleHistoryBuilder.CreateSales(Clients(), Inventory(), To, From);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }
}
