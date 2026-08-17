using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Seeding.Builders;

/// <summary>
/// Generates months of counter sales so the Garážový prodej reports have something to draw.
/// </summary>
/// <remarks>
/// Pure by design, like <see cref="HistoryBuilder"/>: it takes already-materialized entities and
/// returns new ones, never touching a DbContext. Randomness comes from a fixed seed, so the same
/// window always yields the same sales.
///
/// Deliberately shaped to exercise every branch of the three report tabs rather than to look
/// average: discounted and full-price lines, lines sold above list, free-form stock with no
/// product behind it, invoices paid and unpaid (some long overdue), known clients and anonymous
/// walk-ins, and a slice of the warehouse that never sells at all.
///
/// Stock is NOT decremented. The Complete command is the writer of the stock ledger for real
/// sales; replaying months of history through it would drive quantities far negative, and the
/// stock-coverage report deliberately relates *today's* shelf to the window's sales rate.
/// </remarks>
internal static class SaleHistoryBuilder
{
    /// <summary>Fixed so output is reproducible and assertable in tests.</summary>
    private const int RandomSeed = 20260817;

    private const int MinSalesPerWeek = 5;
    private const int MaxSalesPerWeek = 10;

    /// <summary>Share of sales made by a client from the book rather than a walk-in.</summary>
    private const double ClientBuyerShare = 0.45;

    /// <summary>Share of walk-ins who give a name at all — the rest are anonymous cash sales.</summary>
    private const double NamedWalkinShare = 0.55;

    /// <summary>Share of sales settled by invoice rather than cash at the counter.</summary>
    private const double InvoiceShare = 0.3;

    /// <summary>Share of invoices already paid. The rest feed the outstanding list.</summary>
    private const double InvoicePaidShare = 0.72;

    /// <summary>Share of lines sold below the ceník price.</summary>
    private const double DiscountedLineShare = 0.28;

    /// <summary>Share of lines sold slightly above list — a surcharge is not a negative discount.</summary>
    private const double SurchargedLineShare = 0.04;

    /// <summary>Share of sales that include a free-form line with no product behind it.</summary>
    private const double FreeFormLineShare = 0.18;

    /// <summary>
    /// Share of the warehouse the counter ever sells from. The remainder is the dead stock the
    /// Zboží tab exists to surface.
    /// </summary>
    private const double SellableStockShare = 0.65;

    /// <summary>Invoice terms, in days from the sale.</summary>
    private const int InvoiceDueDays = 14;

    private static readonly string[] WalkinNames =
    [
        "Josef Vrána", "Marie Nová", "Petr Dvořák", "Jana Kučerová", "Tomáš Beneš",
        "Lucie Marková", "Martin Šťastný", "Eva Horáková", "Pavel Říha", "Klára Němcová",
    ];

    private static readonly string[] FreeFormItems = ["Vratná basa", "Vratný sud", "Přepravka"];

    /// <summary>
    /// Builds completed counter sales across the window, plus a handful of open ones dated in the
    /// last few days so the dashboard's "Rozpracované prodeje" card has rows.
    /// </summary>
    /// <param name="clients">Clients that may appear as buyers.</param>
    /// <param name="inventory">Stock rows the counter sells from; each needs its product loaded.</param>
    /// <param name="from">First day of the window, inclusive.</param>
    /// <param name="to">Last day of the window, inclusive.</param>
    public static List<Sale> CreateSales(
        IReadOnlyList<Client> clients,
        IReadOnlyList<InventoryItem> inventory,
        DateOnly from,
        DateOnly to)
    {
        ArgumentOutOfRangeException.ThrowIfGreaterThan(from, to);
        if (clients.Count == 0)
        {
            throw new ArgumentException("Sales history needs at least one client.", nameof(clients));
        }

        // Free-form lines aside, a sale line is pieces off a stock row, so a row without its
        // product carries no price or packaging to snapshot.
        var sellable = inventory.Where(item => item.Product is not null).ToList();
        if (sellable.Count == 0)
        {
            throw new ArgumentException("Sales history needs at least one stock row with a product.", nameof(inventory));
        }

        var rng = new Random(RandomSeed);

        // Only part of the warehouse ever sells; the rest is what the stock-coverage table
        // reports as never sold.
        var sold = sellable
            .OrderBy(_ => rng.Next())
            .Take(Math.Max(1, (int)(sellable.Count * SellableStockShare)))
            .ToList();

        var sales = new List<Sale>();

        for (var week = from; week <= to; week = week.AddDays(7))
        {
            var salesThisWeek = rng.Next(MinSalesPerWeek, MaxSalesPerWeek + 1);

            for (var i = 0; i < salesThisWeek; i++)
            {
                // The counter is closed on Sunday, so sales land Monday–Saturday.
                var saleDate = week.AddDays(rng.Next(0, 6));
                if (saleDate > to)
                {
                    continue;
                }

                sales.Add(CreateCompletedSale(rng, clients, sold, saleDate));
            }
        }

        sales.AddRange(CreateOpenSales(rng, clients, sold, to));

        return sales;
    }

    /// <summary>One settled sale: stock moved, money accounted for one way or the other.</summary>
    private static Sale CreateCompletedSale(
        Random rng,
        IReadOnlyList<Client> clients,
        IReadOnlyList<InventoryItem> sellable,
        DateOnly saleDate)
    {
        var sale = CreateSaleShell(rng, clients, sellable, saleDate, SaleState.Completed);

        // Settled in the evening of the sale day — the counter closes at six.
        sale.CompletedAt = new DateTimeOffset(
            saleDate.ToDateTime(new TimeOnly(18, 0)), TimeSpan.Zero);

        return sale;
    }

    /// <summary>
    /// A few sales left open in the final days: drafts still being assembled and invoices handed
    /// over but not yet paid.
    /// </summary>
    private static List<Sale> CreateOpenSales(
        Random rng,
        IReadOnlyList<Client> clients,
        IReadOnlyList<InventoryItem> sellable,
        DateOnly to)
    {
        var open = new List<Sale>();

        foreach (var (daysBack, state) in ((int, SaleState)[])
                 [(1, SaleState.Draft), (2, SaleState.Draft), (4, SaleState.AwaitingPayment), (6, SaleState.AwaitingPayment)])
        {
            var sale = CreateSaleShell(rng, clients, sellable, to.AddDays(-daysBack), state);

            if (state == SaleState.AwaitingPayment)
            {
                // Handed over already; only the money is outstanding.
                sale.Payment = SalePaymentMethod.Invoice;
                sale.Billing = CreateBilling(sale, to.AddDays(-daysBack), paid: false, rng);
            }

            open.Add(sale);
        }

        return open;
    }

    /// <summary>The parts every sale shares: buyer, payment, lines.</summary>
    private static Sale CreateSaleShell(
        Random rng,
        IReadOnlyList<Client> clients,
        IReadOnlyList<InventoryItem> sellable,
        DateOnly saleDate,
        SaleState state)
    {
        var isClientBuyer = rng.NextDouble() < ClientBuyerShare;
        var client = isClientBuyer ? clients[rng.Next(clients.Count)] : null;
        var byInvoice = rng.NextDouble() < InvoiceShare;

        var sale = new Sale
        {
            PublicId = Guid.NewGuid(),
            SaleDate = saleDate,
            State = state,
            BuyerKind = isClientBuyer ? SaleBuyerKind.Client : SaleBuyerKind.Walkin,
            Client = client,
            // An anonymous cash sale records no name at all.
            BuyerName = isClientBuyer || rng.NextDouble() > NamedWalkinShare
                ? null
                : WalkinNames[rng.Next(WalkinNames.Length)],
            Payment = byInvoice ? SalePaymentMethod.Invoice : SalePaymentMethod.Cash,
            Items = CreateLines(rng, sellable),
        };

        if (sale.Payment == SalePaymentMethod.Invoice && state == SaleState.Completed)
        {
            sale.Billing = CreateBilling(sale, saleDate, rng.NextDouble() < InvoicePaidShare, rng);
        }

        return sale;
    }

    /// <summary>One to four lines, priced off the ceník with the counter's discounts applied.</summary>
    private static List<SaleItem> CreateLines(Random rng, IReadOnlyList<InventoryItem> sellable)
    {
        var lines = new List<SaleItem>();
        var lineCount = rng.Next(1, 5);

        foreach (var stock in sellable.OrderBy(_ => rng.Next()).Take(lineCount))
        {
            var product = stock.Product!;
            var listPrice = product.PriceWithVat;
            var roll = rng.NextDouble();

            // Discounts land on round tens of percent, the way a counter actually gives them.
            var unitPrice = roll switch
            {
                _ when roll < DiscountedLineShare => Math.Round(listPrice * (1 - rng.Next(1, 4) * 0.05m), 2),
                _ when roll < DiscountedLineShare + SurchargedLineShare => Math.Round(listPrice * 1.05m, 2),
                _ => listPrice,
            };

            lines.Add(new SaleItem
            {
                PublicId = Guid.NewGuid(),
                InventoryItem = stock,
                Product = product,
                Name = product.Name,
                Kind = product.Kind,
                PackageSize = product.PackageSize,
                Quantity = rng.Next(1, 13),
                UnitPriceWithVat = unitPrice,
                ListPriceWithVat = listPrice,
            });
        }

        // Free-form stock has no product and no ceník entry behind it, so it also carries no
        // list price — the discount figures must not count it.
        if (rng.NextDouble() < FreeFormLineShare)
        {
            lines.Add(new SaleItem
            {
                PublicId = Guid.NewGuid(),
                Name = FreeFormItems[rng.Next(FreeFormItems.Length)],
                Quantity = rng.Next(1, 5),
                UnitPriceWithVat = 150m,
            });
        }

        return lines;
    }

    /// <summary>
    /// Billing for an invoiced sale. Unpaid ones are what the Tržby tab's outstanding list draws,
    /// so a few are left far past their due date rather than all sitting just inside it.
    /// </summary>
    private static SaleBillingDetails CreateBilling(Sale sale, DateOnly saleDate, bool paid, Random rng)
    {
        return new SaleBillingDetails
        {
            Name = sale.Client?.Name ?? sale.BuyerName ?? "Neuvedený odběratel",
            CompanyId = rng.Next(10_000_000, 99_999_999).ToString(),
            DueDate = saleDate.AddDays(InvoiceDueDays),
            PaidDate = paid ? saleDate.AddDays(rng.Next(3, InvoiceDueDays + 5)) : null,
        };
    }
}
