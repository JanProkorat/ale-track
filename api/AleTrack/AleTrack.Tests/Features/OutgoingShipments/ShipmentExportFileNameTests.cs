using AleTrack.Features.OutgoingShipments.Queries.Export;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Download name of a shipment export workbook — what a folder of these sorts like, and what
/// survives a browser's Content-Disposition handling.
/// </summary>
public sealed class ShipmentExportFileNameTests
{
    private static ShipmentExportModel BuildModel(string name, DateTime? deliveryDate) =>
        new() { ShipmentName = name, DeliveryDate = deliveryDate };

    [Fact]
    public void For_ShipmentWithADeliveryDate_LeadsWithTheDateSoAFolderSortsChronologically()
    {
        var name = ShipmentExportFileName.For(
            BuildModel("Pátek – Brno", new DateTime(2026, 8, 3, 0, 0, 0, DateTimeKind.Utc)), "xlsx");

        name.Should().Be("vyvoz-2026-08-03-patek-brno.xlsx");
    }

    // The date is dropped rather than replaced by a placeholder or left as an empty segment, so an
    // undated run still produces a clean name.
    [Fact]
    public void For_ShipmentWithNoDeliveryDateYet_OmitsTheDateEntirely()
    {
        var name = ShipmentExportFileName.For(BuildModel("Pátek – Brno", null), "xlsx");

        name.Should().Be("vyvoz-patek-brno.xlsx");
    }

    // The run's name is what keeps two runs on the same day apart.
    [Fact]
    public void For_TwoRunsOnTheSameDay_AreToldApartByTheirNames()
    {
        var date = new DateTime(2026, 8, 3, 0, 0, 0, DateTimeKind.Utc);

        var morning = ShipmentExportFileName.For(BuildModel("Ranní Brno", date), "xlsx");
        var afternoon = ShipmentExportFileName.For(BuildModel("Odpolední Brno", date), "xlsx");

        morning.Should().NotBe(afternoon);
    }

    // The two formats share every naming rule and differ only in the extension, so a folder holding
    // both keeps them side by side under the same run.
    [Fact]
    public void For_TheTwoFormats_DifferOnlyInTheirExtension()
    {
        var model = BuildModel("Pátek – Brno", new DateTime(2026, 8, 3, 0, 0, 0, DateTimeKind.Utc));

        ShipmentExportFileName.For(model, "xlsx").Should().Be("vyvoz-2026-08-03-patek-brno.xlsx");
        ShipmentExportFileName.For(model, "docx").Should().Be("vyvoz-2026-08-03-patek-brno.docx");
    }

    [Theory]
    // Diacritics decompose to plain ASCII rather than being deleted along with the letter.
    [InlineData("Příští čtvrtek", "vyvoz-2026-08-03-pristi-ctvrtek.xlsx")]
    // Punctuation and runs of separators collapse to a single hyphen.
    [InlineData("Brno // Olomouc (velký)", "vyvoz-2026-08-03-brno-olomouc-velky.xlsx")]
    // No leading or trailing hyphen from a name that starts or ends on punctuation.
    [InlineData("— Brno —", "vyvoz-2026-08-03-brno.xlsx")]
    // A name with nothing ASCII-able left in it still yields a usable name.
    [InlineData("///", "vyvoz-2026-08-03.xlsx")]
    public void For_NameNeedingCleanup_ReducesItToUrlSafeAscii(string shipmentName, string expected)
    {
        var name = ShipmentExportFileName.For(
            BuildModel(shipmentName, new DateTime(2026, 8, 3, 0, 0, 0, DateTimeKind.Utc)), "xlsx");

        name.Should().Be(expected);
    }
}
