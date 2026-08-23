using System.Security.Cryptography;
using System.Text;
using AleTrack.Common.Enums;
using AleTrack.Features.OutgoingShipments.Queries.Export;
using ClosedXML.Excel;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// What the shipment export workbook actually contains: the run's overview and route, and the
/// confirmed invoice rows that follow it.
/// </summary>
public sealed class ShipmentExportWorkbookBuilderTests
{
    private static ShipmentExportStop BuildStop(
        int order,
        string clientName,
        string? city = "Brno",
        List<ShipmentExportProduct>? products = null) =>
        new()
        {
            Order = order,
            ClientName = clientName,
            City = city,
            Products = products ?? [BuildProduct("Pilsner Urquell", 24)]
        };

    private static ShipmentExportProduct BuildProduct(
        string name,
        int quantity,
        ProductKind? kind = ProductKind.Bottle,
        double? packageSize = 0.5) =>
        new()
        {
            Name = name,
            Quantity = quantity,
            Kind = kind,
            PackageSize = packageSize
        };

    private static ShipmentExportModel BuildModel(
        string name = "Pátek – Brno",
        DateTime? deliveryDate = null,
        string? vehicleName = "Iveco Daily",
        List<string>? driverNames = null,
        List<ShipmentExportStop>? stops = null,
        List<ShipmentExportProduct>? stockPurchases = null,
        List<ShipmentExportInvoice>? invoices = null) =>
        new()
        {
            ShipmentName = name,
            DeliveryDate = deliveryDate ?? new DateTime(2026, 8, 3, 0, 0, 0, DateTimeKind.Utc),
            VehicleName = vehicleName,
            DriverNames = driverNames ?? ["Jan Novák"],
            Stops = stops ?? [BuildStop(1, "Hospoda U Kotvy")],
            StockPurchases = stockPurchases ?? [],
            Invoices = invoices ?? []
        };

    /// <summary>
    /// One party of an invoice. The delivery details default to none, which is the shape of a party
    /// whose goods this run only bills.
    /// </summary>
    private static ShipmentExportInvoiceParty BuildParty(
        string clientName,
        bool isPayer = false,
        List<ShipmentExportProduct>? products = null,
        string? street = null,
        string? cityLine = null,
        string? deliveryPlaceName = null,
        List<string>? notes = null,
        List<ShipmentExportReturn>? returns = null) =>
        new()
        {
            ClientName = clientName,
            IsPayer = isPayer,
            Street = street,
            CityLine = cityLine,
            DeliveryPlaceName = deliveryPlaceName,
            Notes = notes ?? [],
            Returns = returns ?? [],
            Products = products ?? [BuildProduct("Pilsner Urquell", 24)]
        };

    /// <summary>
    /// Deterministic ID for a client name, so invoices built with the same
    /// <paramref name="payingClientName"/> share an identity by default — pass
    /// <paramref name="payingClientId"/> explicitly to test two distinct clients sharing a name.
    /// </summary>
    private static ShipmentExportInvoice BuildInvoice(
        string payingClientName,
        int sequence,
        List<ShipmentExportInvoiceParty> parties,
        int number = 1,
        Guid? payingClientId = null,
        List<ShipmentExportBillingRecipient>? billingRecipients = null) =>
        new()
        {
            Number = number,
            PayingClientName = payingClientName,
            PayingClientId = payingClientId ?? new Guid(MD5.HashData(Encoding.UTF8.GetBytes(payingClientName))),
            Sequence = sequence,
            Parties = parties,
            BillingRecipients = billingRecipients ?? []
        };

    private static ShipmentExportBillingRecipient BuildRecipient(
        string clientName, string street = "Hlavní 12", string cityLine = "602 00 Brno") =>
        new() { ClientName = clientName, Street = street, CityLine = cityLine };

    private static XLWorkbook Open(ShipmentExportModel model) =>
        new(new MemoryStream(ShipmentExportWorkbookBuilder.Build(model)));

    /// <summary>
    /// Finds the row a label sits on, so a test does not break when a block above it grows a line.
    /// </summary>
    private static int RowOf(IXLWorksheet sheet, string label, int occurrence = 1)
    {
        var cell = sheet.Column(1).CellsUsed(c => c.GetString() == label).ElementAtOrDefault(occurrence - 1);
        cell.Should().NotBeNull($"the sheet should carry occurrence {occurrence} of a \"{label}\" row");
        return cell!.Address.RowNumber;
    }

    /// <summary>
    /// Two sheets and no more: the route is a table on the overview, and the goods are read off the
    /// invoice rows. A per-stop sheet duplicated both and was never what the office asked for.
    /// </summary>
    [Fact]
    public void Build_Model_ProducesTheOverviewAndTheInvoiceSheetOnly()
    {
        var model = BuildModel(
            stops:
            [
                BuildStop(1, "Hospoda U Kotvy"),
                new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" },
                BuildStop(3, "Pivnice Na Růhu")
            ],
            invoices:
            [
                BuildInvoice("Hospoda U Kotvy", sequence: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)])
            ]);

        using var workbook = Open(model);

        workbook.Worksheets.Select(s => s.Name).Should().Equal("Přehled", "Fakturace");
    }

    [Fact]
    public void Build_OverviewSheet_SummarisesTheRun()
    {
        var model = BuildModel(
            driverNames: ["Petr Adamec", "Jan Novák"],
            stops:
            [
                BuildStop(1, "Hospoda U Kotvy", products: [BuildProduct("Pilsner Urquell", 24)]),
                new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" },
                BuildStop(3, "Pivnice Na Růhu", city: "Olomouc", products: [BuildProduct("Kozel 11", 6)])
            ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Přehled");

        sheet.Cell(RowOf(sheet, "Vývoz"), 2).GetString().Should().Be("Pátek – Brno");
        sheet.Cell(RowOf(sheet, "Vozidlo"), 2).GetString().Should().Be("Iveco Daily");
        sheet.Cell(RowOf(sheet, "Řidiči"), 2).GetString().Should().Be("Petr Adamec, Jan Novák");

        // A real date cell rather than text, so the reader can sort a folder of these.
        var dateCell = sheet.Cell(RowOf(sheet, "Datum dodání"), 2);
        dateCell.GetDateTime().Should().Be(new DateTime(2026, 8, 3, 0, 0, 0, DateTimeKind.Unspecified));

        sheet.Cell(RowOf(sheet, "Zastávek"), 2).GetValue<int>().Should().Be(3);
        sheet.Cell(RowOf(sheet, "Klientů"), 2).GetValue<int>().Should().Be(2, "the custom stop has no client");
        sheet.Cell(RowOf(sheet, "Celkem kusů"), 2).GetValue<int>().Should().Be(30);

        // Every stop is listed, custom ones by their label — this table is the only place they show.
        var tableHeaderRow = RowOf(sheet, "ZASTÁVKA");
        sheet.Cell(tableHeaderRow + 1, 2).GetString().Should().Be("Hospoda U Kotvy");
        sheet.Cell(tableHeaderRow + 1, 4).GetValue<int>().Should().Be(24);
        sheet.Cell(tableHeaderRow + 2, 2).GetString().Should().Be("Čerpací stanice");
        sheet.Cell(tableHeaderRow + 2, 4).GetString().Should().Be("—", "a custom stop delivers nothing");
        sheet.Cell(tableHeaderRow + 3, 3).GetString().Should().Be("Olomouc");
    }

    /// <summary>
    /// The route table is the driver's page, so it lists the whole run — including a client whose
    /// row nobody has confirmed and which therefore reaches no invoice block at all.
    /// </summary>
    [Fact]
    public void Build_OverviewSheet_ListsEveryStopIncludingUnconfirmedOnes()
    {
        var model = BuildModel(
            stops: [BuildStop(1, "Hospoda U Kotvy"), BuildStop(2, "Pivnice Na Růhu")],
            invoices:
            [
                BuildInvoice("Pivnice Na Růhu", sequence: 1, parties: [BuildParty("Pivnice Na Růhu", isPayer: true)])
            ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Přehled");
        var tableHeaderRow = RowOf(sheet, "ZASTÁVKA");

        sheet.Cell(tableHeaderRow + 1, 2).GetString().Should().Be("Hospoda U Kotvy");
        sheet.Cell(tableHeaderRow + 2, 2).GetString().Should().Be("Pivnice Na Růhu");
        sheet.Cell(RowOf(sheet, "Zastávek"), 2).GetValue<int>().Should().Be(2);
    }

    // The run's internal number means nothing to whoever reads this file, and the date plus the name
    // already identify which run it is.
    [Fact]
    public void Build_OverviewSheet_DoesNotCarryTheRunsInternalNumber()
    {
        using var workbook = Open(BuildModel());
        var sheet = workbook.Worksheet("Přehled");

        sheet.Column(1).CellsUsed(c => c.GetString() == "Číslo").Should().BeEmpty();
        sheet.CellsUsed(c => c.GetString().StartsWith('#')).Should().BeEmpty();
    }

    [Fact]
    public void Build_InvoiceParty_WritesWhereTheGoodsWentItsProductsAndATotal()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice(
                "Hospoda U Kotvy",
                sequence: 1,
                parties:
                [
                    BuildParty(
                        "Hospoda U Kotvy",
                        isPayer: true,
                        street: "Dlouhá 14",
                        cityLine: "602 00 Brno",
                        deliveryPlaceName: "Zahrádka",
                        notes: ["Volat 30 min předem", "Brána z boku"],
                        products:
                        [
                            BuildProduct("Pilsner Urquell", 24),
                            BuildProduct("Kozel 11", 6, ProductKind.Keg, 30),
                            // A custom extra: ordered all the same, but with no product behind it.
                            BuildProduct("Slunečník", 2, kind: null, packageSize: null)
                        ])
                ])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Fakturace");

        sheet.Cell(RowOf(sheet, "Adresa"), 2).GetString().Should().Be("Dlouhá 14, 602 00 Brno");
        sheet.Cell(RowOf(sheet, "Místo dodání"), 2).GetString().Should().Be("Zahrádka");

        // The second note continues under the first with no repeated label.
        var notesRow = RowOf(sheet, "Poznámky");
        sheet.Cell(notesRow, 2).GetString().Should().Be("Volat 30 min předem");
        sheet.Cell(notesRow + 1, 1).GetString().Should().BeEmpty();
        sheet.Cell(notesRow + 1, 2).GetString().Should().Be("Brána z boku");

        var headerRow = RowOf(sheet, "PRODUKT");
        sheet.Cell(headerRow, 2).GetString().Should().Be("DRUH");
        sheet.Cell(headerRow, 3).GetString().Should().Be("BALENÍ (L)");
        sheet.Cell(headerRow, 4).GetString().Should().Be("MNOŽSTVÍ (KS)");

        sheet.Cell(headerRow + 1, 1).GetString().Should().Be("Pilsner Urquell");
        sheet.Cell(headerRow + 1, 2).GetString().Should().Be("Basa");
        sheet.Cell(headerRow + 1, 3).GetValue<double>().Should().Be(0.5);
        sheet.Cell(headerRow + 1, 4).GetValue<int>().Should().Be(24);

        sheet.Cell(headerRow + 2, 2).GetString().Should().Be("Sud");
        sheet.Cell(headerRow + 2, 3).GetValue<double>().Should().Be(30);

        sheet.Cell(headerRow + 3, 1).GetString().Should().Be("Slunečník");
        sheet.Cell(headerRow + 3, 2).GetString().Should().Be("—");
        sheet.Cell(headerRow + 3, 3).GetString().Should().Be("—");

        var totalRow = RowOf(sheet, "Celkem");
        sheet.Cell(totalRow, 4).GetValue<int>().Should().Be(32);

        // Quantities are numbers, not text, so the office can sum a column in Excel itself.
        sheet.Cell(headerRow + 1, 4).DataType.Should().Be(XLDataType.Number);
    }

    /// <summary>
    /// A party the run only bills — its own delivery went out on another run — has no address, no
    /// notes and no vratky, and gets no empty rows claiming otherwise.
    /// </summary>
    [Fact]
    public void Build_PartyWithNoDelivery_WritesNoDeliveryRowsAtAll()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Fakturace");

        sheet.Column(1).CellsUsed(c => c.GetString() == "Adresa").Should().BeEmpty();
        sheet.Column(1).CellsUsed(c => c.GetString() == "Místo dodání").Should().BeEmpty();
        sheet.Column(1).CellsUsed(c => c.GetString() == "Poznámky").Should().BeEmpty();
        sheet.Column(1).CellsUsed(c => c.GetString() == "VRACÍ").Should().BeEmpty();
    }

    [Fact]
    public void Build_PartyWithReturns_WritesThemBelowTheProducts()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
            [
                BuildParty("Hospoda U Kotvy", isPayer: true, returns:
                [
                    new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6, Note = "poškozený ventil" }
                ])
            ])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Fakturace");

        var headingRow = RowOf(sheet, "VRACÍ");
        RowOf(sheet, "PRODUKT").Should().BeLessThan(headingRow, "what goes back reads after what is delivered");

        // Contiguous columns. The quantity deliberately does not line up with the products table's:
        // these pieces travel the other way and must never be summed into the delivered total.
        sheet.Cell(headingRow + 1, 1).GetString().Should().Be("POLOŽKA");
        sheet.Cell(headingRow + 1, 2).GetString().Should().Be("POZNÁMKA");
        sheet.Cell(headingRow + 1, 3).GetString().Should().Be("MNOŽSTVÍ (KS)");

        sheet.Cell(headingRow + 2, 1).GetString().Should().Be("Sud 30l KEG");
        sheet.Cell(headingRow + 2, 2).GetString().Should().Be("poškozený ventil");
        sheet.Cell(headingRow + 2, 3).GetValue<int>().Should().Be(6);
    }

    // Most vratky carry no note, and an always-present empty column reads as information that failed
    // to load rather than information that does not exist.
    [Fact]
    public void Build_ReturnsWithNoNotes_DropTheNoteColumnEntirely()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
            [
                BuildParty("Hospoda U Kotvy", isPayer: true, returns:
                [
                    new ShipmentExportReturn { Name = "Basa", Quantity = 25 },
                    new ShipmentExportReturn { Name = "Velký sud", Quantity = 3 }
                ])
            ])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Fakturace");

        var headingRow = RowOf(sheet, "VRACÍ");

        sheet.Cell(headingRow + 1, 1).GetString().Should().Be("POLOŽKA");
        sheet.Cell(headingRow + 1, 2).GetString().Should().Be("MNOŽSTVÍ (KS)");
        sheet.Cell(headingRow + 1, 3).GetString().Should().BeEmpty("there is no third column to head");

        sheet.Cell(headingRow + 2, 1).GetString().Should().Be("Basa");
        sheet.Cell(headingRow + 2, 2).GetValue<int>().Should().Be(25);
        sheet.Cell(headingRow + 3, 2).GetValue<int>().Should().Be(3);
    }

    /// <summary>
    /// Every column of a heading band is shaded. An earlier layout skipped one so the returns table
    /// could line its quantity up with the products table's, which left an unshaded hole mid-band.
    /// </summary>
    [Fact]
    public void Build_HeadingBands_AreShadedWithNoGaps()
    {
        var model = BuildModel(
            invoices:
            [
                BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
                [
                    BuildParty("Hospoda U Kotvy", isPayer: true, returns:
                    [
                        new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6, Note = "prasklý" }
                    ])
                ])
            ],
            stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)]);

        using var workbook = Open(model);

        // The exact fill, not merely "not NoColor": an untouched ClosedXML cell does not report
        // NoColor, so a not-equal assertion here would pass for every cell in the sheet and prove
        // nothing at all.
        var expected = XLColor.FromArgb(0xF2, 0xF2, 0xF2);

        var overview = workbook.Worksheet("Přehled");
        var invoiceSheet = workbook.Worksheet("Fakturace");

        foreach (var (sheet, headerRow, columns) in new[]
                 {
                     (overview, RowOf(overview, "ZASTÁVKA"), 4),
                     (overview, RowOf(overview, "PRODUKT"), 4),
                     (invoiceSheet, RowOf(invoiceSheet, "PRODUKT"), 4),
                     (invoiceSheet, RowOf(invoiceSheet, "POLOŽKA"), 3)
                 })
        {
            for (var column = 1; column <= columns; column++)
            {
                var cell = sheet.Cell(headerRow, column);
                cell.Style.Fill.BackgroundColor.Should().Be(expected, $"{sheet.Name}!{cell.Address}");
                cell.GetString().Should().NotBeEmpty($"{sheet.Name}!{cell.Address}");
            }
        }

        // Proof the assertion above can fail: the rows under a band are not shaded.
        invoiceSheet.Cell(RowOf(invoiceSheet, "PRODUKT") + 1, 1).Style.Fill.BackgroundColor
            .Should().NotBe(expected, "only the heading band is shaded");
    }

    /// <summary>
    /// Numbers stay numbers and carry a format, so Excel groups thousands using the reader's own
    /// separators and the office can still sum the column.
    /// </summary>
    [Fact]
    public void Build_Numbers_AreRealNumbersCarryingAFormat()
    {
        var model = BuildModel(
            stops:
            [
                BuildStop(1, "Hospoda U Kotvy", products:
                [
                    new ShipmentExportProduct
                    {
                        Name = "Pilsner Urquell", Kind = ProductKind.Bottle,
                        PackageSize = 0.5, Weight = 15.7, Quantity = 1200
                    }
                ])
            ],
            invoices:
            [
                BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
                [
                    BuildParty("Hospoda U Kotvy", isPayer: true, products:
                    [
                        BuildProduct("Pilsner Urquell", 1200)
                    ])
                ])
            ]);

        using var workbook = Open(model);

        var overview = workbook.Worksheet("Přehled");
        var weight = overview.Cell(RowOf(overview, "Hmotnost (kg)"), 2);
        weight.DataType.Should().Be(XLDataType.Number);
        weight.Style.NumberFormat.Format.Should().Be("#,##0.0");
        weight.GetValue<double>().Should().BeApproximately(18840, 0.01);

        var sheet = workbook.Worksheet("Fakturace");
        var headerRow = RowOf(sheet, "PRODUKT");

        // Package size carries no explicit format on purpose: General renders 0,5 and 30 in the
        // reader's own locale, while every decimal format either pads a whole size with zeros or
        // leaves a trailing separator behind ("30,").
        //
        // Asserted on the format rather than on GetFormattedString(): that renders using the ambient
        // culture, so an expected "0,5" passes on a comma-decimal machine and fails on CI.
        var size = sheet.Cell(headerRow + 1, 3);
        size.DataType.Should().Be(XLDataType.Number);
        size.GetValue<double>().Should().Be(0.5);
        size.Style.NumberFormat.Format.Should().BeEmpty("General, so the reader's locale decides");

        var quantity = sheet.Cell(headerRow + 1, 4);
        quantity.DataType.Should().Be(XLDataType.Number);
        quantity.Style.NumberFormat.Format.Should().Be("#,##0");
    }

    /// <summary>
    /// Column 1 of the overview also holds the stock block's product names, the longest text on that
    /// sheet — at 22 wide "Svijanský Vozka yuzu &amp; bergamot" was cut off mid-word.
    /// </summary>
    [Fact]
    public void Build_OverviewFirstColumn_IsWideEnoughForAProductName()
    {
        var model = BuildModel(stockPurchases:
        [
            BuildProduct("Svijanský Vozka yuzu & bergamot", 1, ProductKind.Can, 0.5)
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Přehled");

        sheet.Column(1).Width.Should().BeGreaterThanOrEqualTo("Svijanský Vozka yuzu & bergamot".Length);
    }

    // A label answered by a number sat a stride away from it when Excel right-aligned the value.
    [Fact]
    public void Build_LabelBlockValues_SitNextToTheirLabel()
    {
        using var workbook = Open(BuildModel());
        var sheet = workbook.Worksheet("Přehled");

        foreach (var label in new[] { "Datum dodání", "Zastávek", "Klientů", "Celkem kusů", "Hmotnost (kg)" })
        {
            sheet.Cell(RowOf(sheet, label), 2).Style.Alignment.Horizontal
                .Should().Be(XLAlignmentHorizontalValues.Left, label);
        }
    }

    // One driver is not a list of one.
    [Theory]
    [InlineData("Řidič", "Jan Novák")]
    [InlineData("Řidiči", "Jan Novák", "Petr Adamec")]
    public void Build_LabelsTheDriverRowForHowManyDrive(string expected, params string[] drivers)
    {
        using var workbook = Open(BuildModel(driverNames: [.. drivers]));
        var sheet = workbook.Worksheet("Přehled");

        sheet.Column(1).CellsUsed(c => c.GetString() == expected).Should().HaveCount(1);
    }

    /// <summary>
    /// The run calls at our own warehouse to drop the goods bought for stock, so the route table
    /// reports that stop's town and piece count like any other.
    /// </summary>
    [Fact]
    public void Build_WarehouseStop_ReportsItsGoodsOnTheRouteTableInsteadOfTheStockBlock()
    {
        var stockGoods = new List<ShipmentExportProduct> { BuildProduct("Radegast", 3, ProductKind.Keg, 50) };

        var model = BuildModel(
            stops:
            [
                BuildStop(1, "Hospoda U Kotvy"),
                new ShipmentExportStop
                {
                    Order = 2, IsWarehouse = true, Label = "AleTrack s.r.o.",
                    City = "Liberec", Products = stockGoods
                }
            ],
            stockPurchases: stockGoods);

        using var workbook = Open(model);
        var overview = workbook.Worksheet("Přehled");
        var stopsHeader = RowOf(overview, "ZASTÁVKA");

        // The row that used to read "— —".
        overview.Cell(stopsHeader + 2, 2).GetString().Should().Be("AleTrack s.r.o.");
        overview.Cell(stopsHeader + 2, 3).GetString().Should().Be("Liberec");
        overview.Cell(stopsHeader + 2, 4).GetValue<int>().Should().Be(3);

        // Not counted twice: the route table above already reports these pieces.
        overview.Column(1).CellsUsed(c => c.GetString() == "ZBOŽÍ NA SKLAD").Should().BeEmpty();
    }

    [Fact]
    public void Build_StockPurchasesBlock_HasASingleQuantityColumn()
    {
        var model = BuildModel(stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Přehled");
        var headingRow = RowOf(sheet, "ZBOŽÍ NA SKLAD");

        sheet.Cell(headingRow + 1, 4).GetString().Should().Be("MNOŽSTVÍ (KS)");
        sheet.Cell(headingRow + 1, 5).GetString().Should().BeEmpty("there is no fifth column to head");
        sheet.Cell(headingRow + 2, 5).GetString().Should().BeEmpty();
    }

    /// <summary>
    /// The fallback for a run that carries stock goods without a warehouse stop — one saved before
    /// the company stop existed. Better an odd-looking block on the overview than goods that appear
    /// nowhere in the file.
    /// </summary>
    [Fact]
    public void Build_StockPurchasesWithNoWarehouseStop_GetABlockOnTheOverviewSheet()
    {
        var model = BuildModel(stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)]);

        using var workbook = Open(model);

        var sheet = workbook.Worksheet("Přehled");
        var headingRow = RowOf(sheet, "ZBOŽÍ NA SKLAD");

        sheet.Cell(headingRow + 2, 1).GetString().Should().Be("Radegast");
        sheet.Cell(headingRow + 2, 4).GetValue<int>().Should().Be(3);
    }

    [Fact]
    public void Build_NoStockPurchases_OmitsTheBlock()
    {
        using var workbook = Open(BuildModel());

        workbook.Worksheet("Přehled").Column(1)
            .CellsUsed(c => c.GetString() == "ZBOŽÍ NA SKLAD")
            .Should().BeEmpty();
    }

    [Fact]
    public void Build_PartyWithNoProducts_SaysSoRatherThanLeavingTheTableBlank()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
            [
                BuildParty("Hospoda U Kotvy", isPayer: true, products: [])
            ])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Fakturace");

        sheet.Cell(RowOf(sheet, "PRODUKT") + 1, 1).GetString().Should().Be("Bez položek");
    }

    [Fact]
    public void Build_ModelWithInvoices_AddsTheFakturaceSheet()
    {
        var payerParty = BuildParty(
            "Hospoda U Kotvy", isPayer: true, products: [BuildProduct("Pilsner Urquell", 24)]);
        var otherParty = BuildParty(
            "Pivnice Na Rohu", products: [BuildProduct("Kozel 11", 6, ProductKind.Keg, 30)]);

        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, number: 2, parties: [payerParty, otherParty])
        ]);

        using var workbook = Open(model);

        workbook.Worksheets.Select(s => s.Name).Should().Contain("Fakturace");
        var sheet = workbook.Worksheet("Fakturace");

        // The payer holds only this one invoice, so the heading carries no "Faktura 1" suffix — but
        // it does lead with the number the office confirmed the row under. Its party row carries the
        // "vlastní zboží" marker instead, matching the Word export.
        var headingRow = RowOf(sheet, "2 · Hospoda U Kotvy");
        var payerPartyRow = RowOf(sheet, "Hospoda U Kotvy · vlastní zboží");
        payerPartyRow.Should().BeGreaterThan(headingRow);

        sheet.Cell(payerPartyRow, 4).GetValue<int>().Should().Be(24);

        // Each party carries its own subtotal in column 4 …
        var otherPartyRow = RowOf(sheet, "Pivnice Na Rohu");
        sheet.Cell(otherPartyRow, 4).GetValue<int>().Should().Be(6);

        // … and the block ends with the payer's own total across both parties.
        var totalRow = RowOf(sheet, "Celkem");
        sheet.Cell(totalRow, 4).GetValue<int>().Should().Be(30);
    }

    /// <summary>
    /// The blocks come out in the order the office confirmed the rows, which is the order the model
    /// hands them over in — the sheet must not reorder them by name or by anything else.
    /// </summary>
    [Fact]
    public void Build_InvoiceBlocks_FollowTheConfirmationNumbers()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Pivnice Na Rohu", sequence: 1, number: 1, parties: [BuildParty("Pivnice Na Rohu", isPayer: true)]),
            BuildInvoice("Hospoda U Kotvy", sequence: 1, number: 2, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Fakturace");

        RowOf(sheet, "1 · Pivnice Na Rohu").Should().BeLessThan(RowOf(sheet, "2 · Hospoda U Kotvy"));
    }

    [Fact]
    public void Build_ModelWithoutInvoices_OmitsTheFakturaceSheet()
    {
        using var workbook = Open(BuildModel());

        workbook.Worksheets.Select(s => s.Name).Should().NotContain("Fakturace");
    }

    [Fact]
    public void Build_InvoiceWithBillingRecipients_WritesTheSectionWithNamesAndAddresses()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice(
                "Hospoda U Kotvy", sequence: 1,
                parties: [BuildParty("Hospoda U Kotvy", isPayer: true)],
                billingRecipients:
                [
                    BuildRecipient("Bar Na Rohu", "Nádražní 5", "110 00 Praha"),
                    BuildRecipient("Hospoda U Lípy", "Hlavní 12", "602 00 Brno")
                ])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Fakturace");

        var headingRow = RowOf(sheet, "FAKTURAČNÍ ADRESA PRO HOSPODA U KOTVY");
        sheet.Cell(headingRow + 1, 1).GetString().Should().Be("Bar Na Rohu");
        sheet.Cell(headingRow + 1, 2).GetString().Should().Be("Nádražní 5, 110 00 Praha");
        sheet.Cell(headingRow + 2, 1).GetString().Should().Be("Hospoda U Lípy");
        sheet.Cell(headingRow + 2, 2).GetString().Should().Be("Hlavní 12, 602 00 Brno");
    }

    [Fact]
    public void Build_InvoiceWithNoBillingRecipients_WritesNoSection()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Fakturace");

        sheet.Column(1).CellsUsed(c => c.GetString().StartsWith("FAKTURAČNÍ ADRESA")).Should().BeEmpty();
    }

    /// <summary>
    /// ClosedXML 0.105.1 preserves a grouped row's <c>OutlineLevel</c> through a save/reload
    /// round-trip, but not the <c>IsHidden</c> flag <c>.Collapse()</c> would set — confirmed by a
    /// throwaway probe test before this one was written. The sheet therefore opens expanded; only
    /// the outline level is asserted here.
    /// </summary>
    [Fact]
    public void Build_PartyDetailRows_AreGrouped()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
            [
                BuildParty("Hospoda U Kotvy", isPayer: true, street: "Dlouhá 14", cityLine: "602 00 Brno")
            ])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Fakturace");

        var partyRow = RowOf(sheet, "Hospoda U Kotvy · vlastní zboží");
        var addressRow = RowOf(sheet, "Adresa");
        var productHeaderRow = RowOf(sheet, "PRODUKT");

        sheet.Row(partyRow).OutlineLevel.Should().Be(0, "the party's own row is not part of the group");
        sheet.Row(addressRow).OutlineLevel.Should().Be(1, "where the goods went collapses with the detail");
        // The grouped range starts at the party's first detail row, so the product table's own
        // header shares the group with the rows beneath it.
        sheet.Row(productHeaderRow).OutlineLevel.Should().Be(1, "the product header is part of the group");
        sheet.Row(productHeaderRow + 1).OutlineLevel.Should().Be(1, "the product row is grouped under its party");
    }

    [Fact]
    public void Build_ClientWithTwoInvoices_LabelsEachWithItsSequence()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, number: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)]),
            BuildInvoice("Hospoda U Kotvy", sequence: 2, number: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)]),
            BuildInvoice("Pivnice Na Rohu", sequence: 1, number: 2, parties: [BuildParty("Pivnice Na Rohu", isPayer: true)])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Fakturace");

        // Both blocks of one client share its number — it is one confirmed row — so the sequence is
        // what tells them apart.
        sheet.Column(1).CellsUsed(c => c.GetString() == "1 · Hospoda U Kotvy · Faktura 1").Should().HaveCount(1);
        sheet.Column(1).CellsUsed(c => c.GetString() == "1 · Hospoda U Kotvy · Faktura 2").Should().HaveCount(1);

        // The one-invoice payer gets no meaningless "Faktura 1". Its own party row carries the
        // "vlastní zboží" marker, matching the Word export.
        sheet.Column(1).CellsUsed(c => c.GetString() == "2 · Pivnice Na Rohu · Faktura 1").Should().BeEmpty();
        sheet.Column(1).CellsUsed(c => c.GetString() == "2 · Pivnice Na Rohu").Should().HaveCount(1);
        sheet.Column(1).CellsUsed(c => c.GetString() == "Pivnice Na Rohu · vlastní zboží").Should().HaveCount(1);
    }

    /// <summary>
    /// Two distinct clients can genuinely share a name (that is what <c>BusinessName</c> exists
    /// for), and each holding exactly one invoice here must not be mistaken for the same client
    /// holding two — which would wrongly suffix both with "Faktura 1".
    /// </summary>
    [Fact]
    public void Build_TwoDistinctClientsSharingAName_NeitherGetsASequenceSuffix()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, number: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)], payingClientId: Guid.NewGuid()),
            BuildInvoice("Hospoda U Kotvy", sequence: 1, number: 2, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)], payingClientId: Guid.NewGuid())
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Fakturace");

        sheet.Column(1).CellsUsed(c => c.GetString().Contains("Faktura")).Should().BeEmpty();
        // Their own numbers are what keep them apart, not a sequence suffix neither has earned.
        sheet.Column(1).CellsUsed(c => c.GetString() == "1 · Hospoda U Kotvy").Should().HaveCount(1);
        sheet.Column(1).CellsUsed(c => c.GetString() == "2 · Hospoda U Kotvy").Should().HaveCount(1);
        sheet.Column(1).CellsUsed(c => c.GetString() == "Hospoda U Kotvy · vlastní zboží").Should().HaveCount(2);
    }
}
