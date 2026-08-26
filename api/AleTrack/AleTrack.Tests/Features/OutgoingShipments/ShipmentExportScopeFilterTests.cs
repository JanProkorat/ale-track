using AleTrack.Common.Enums;
using AleTrack.Features.OutgoingShipments.Queries.Export;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// What each of the three scopes leaves in the file.
/// </summary>
/// <remarks>
/// A pure function on the model, so these tests build one by hand: no database, no spreadsheet, and
/// no invoice split to reconcile. The writers are exercised against whatever this leaves behind and
/// know nothing of scopes themselves, which is why every scope's meaning is pinned here.
/// </remarks>
public sealed class ShipmentExportScopeFilterTests
{
    private static ShipmentExportDeviation Short(int planned, int actual) =>
        new()
        {
            Target = ClientLedgerEntryTarget.ProductQuantity,
            PlannedQuantity = planned,
            ActualQuantity = actual
        };

    /// <summary>
    /// Two invoices: U Kotvy diverged three ways — a short line, a short vratka and money owed,
    /// plus a keg taken at the door — while U Lva went exactly to plan.
    /// </summary>
    private static ShipmentExportModel Run() =>
        new()
        {
            ShipmentName = "Severní trasa",
            DeliveryDate = new DateTime(2026, 8, 20, 0, 0, 0, DateTimeKind.Utc),
            VehicleName = "3A2 1234",
            DriverNames = ["Jan Novák"],
            Stops =
            [
                new ShipmentExportStop { Order = 1, ClientName = "Hospoda U Kotvy", City = "Brno" },
                new ShipmentExportStop { Order = 2, ClientName = "Hospoda U Lva", City = "Olomouc" }
            ],
            Invoices =
            [
                new ShipmentExportInvoice
                {
                    Number = 1,
                    PayingClientName = "Hospoda U Kotvy",
                    PayingClientId = Guid.NewGuid(),
                    Parties =
                    [
                        new ShipmentExportInvoiceParty
                        {
                            ClientName = "Hospoda U Kotvy",
                            IsPayer = true,
                            Street = "Dlouhá 14",
                            CityLine = "602 00 Brno",
                            Notes = ["Zvonit vzadu"],
                            Products =
                            [
                                new ShipmentExportProduct
                                {
                                    Name = "Pilsner Urquell", Quantity = 24, Deviation = Short(24, 18)
                                },
                                new ShipmentExportProduct { Name = "Radegast 10", Quantity = 6 },
                                new ShipmentExportProduct
                                {
                                    Name = "Kozel 11", Quantity = 0, IsFromDeviation = true, Deviation = Short(0, 12)
                                }
                            ],
                            Returns =
                            [
                                new ShipmentExportReturn { Name = "Sud 50 l", Quantity = 4, Deviation = Short(4, 1) },
                                new ShipmentExportReturn { Name = "Přepravka", Quantity = 2 }
                            ],
                            Deviations =
                            [
                                new ShipmentExportDeviation
                                {
                                    Target = ClientLedgerEntryTarget.Money, Amount = 2400m, RequiresFollowUp = true
                                }
                            ]
                        }
                    ]
                },
                new ShipmentExportInvoice
                {
                    Number = 2,
                    PayingClientName = "Hospoda U Lva",
                    PayingClientId = Guid.NewGuid(),
                    Parties =
                    [
                        new ShipmentExportInvoiceParty
                        {
                            ClientName = "Hospoda U Lva",
                            IsPayer = true,
                            Notes = ["Volat dopředu"],
                            Products = [new ShipmentExportProduct { Name = "Kozel 11", Quantity = 12 }],
                            Returns = [new ShipmentExportReturn { Name = "Sud 30 l", Quantity = 1 }]
                        }
                    ]
                }
            ]
        };

    private static ShipmentExportInvoiceParty PartyOf(ShipmentExportModel model, string clientName) =>
        model.Invoices.SelectMany(i => i.Parties).Single(p => p.ClientName == clientName);

    /// <summary>
    /// The plan is the paper printed before the run: no deviation anywhere, and no row that exists
    /// only because of one.
    /// </summary>
    [Fact]
    public void Apply_Plan_LeavesTheModelTheWritersWereWrittenAgainst()
    {
        var model = ShipmentExportScopeFilter.Apply(Run(), ShipmentExportScope.Plan);

        var kotvy = PartyOf(model, "Hospoda U Kotvy");

        kotvy.Products.Select(p => p.Name).Should().Equal("Pilsner Urquell", "Radegast 10");
        kotvy.Products.Should().OnlyContain(p => p.Deviation == null);
        kotvy.Returns.Should().HaveCount(2).And.OnlyContain(r => r.Deviation == null);
        kotvy.Deviations.Should().BeEmpty();
        kotvy.HasDeviations.Should().BeFalse();

        // What the plan did say is untouched.
        kotvy.Products.Single(p => p.Name == "Pilsner Urquell").Quantity.Should().Be(24);
        kotvy.Notes.Should().Equal("Zvonit vzadu");
        model.Invoices.Should().HaveCount(2);
    }

    [Fact]
    public void Apply_Changed_KeepsOnlyWhatDiverged()
    {
        var model = ShipmentExportScopeFilter.Apply(Run(), ShipmentExportScope.Changed);

        model.Invoices.Should().ContainSingle("U Lva went to plan, so its block has nothing to say")
            .Which.PayingClientName.Should().Be("Hospoda U Kotvy");

        var kotvy = PartyOf(model, "Hospoda U Kotvy");

        kotvy.Products.Select(p => p.Name).Should().Equal("Pilsner Urquell", "Kozel 11");
        kotvy.Returns.Select(r => r.Name).Should().Equal("Sud 50 l");
        kotvy.Deviations.Should().ContainSingle().Which.Amount.Should().Be(2400m);

        // Unchanged content is exactly what this scope exists to leave out — but the address stays,
        // because a correction has to say whose delivery it corrects.
        kotvy.Notes.Should().BeEmpty();
        kotvy.Street.Should().Be("Dlouhá 14");
    }

    /// <summary>
    /// The run's own page survives every scope: a correction with no run named on it is not filed
    /// anywhere.
    /// </summary>
    [Fact]
    public void Apply_Changed_KeepsTheRunItself()
    {
        var model = ShipmentExportScopeFilter.Apply(Run(), ShipmentExportScope.Changed);

        model.ShipmentName.Should().Be("Severní trasa");
        model.VehicleName.Should().Be("3A2 1234");
        model.Stops.Should().HaveCount(2);
    }

    [Fact]
    public void Apply_All_ChangesNothing()
    {
        var model = ShipmentExportScopeFilter.Apply(Run(), ShipmentExportScope.All);

        var kotvy = PartyOf(model, "Hospoda U Kotvy");

        kotvy.Products.Should().HaveCount(3);
        kotvy.Returns.Should().HaveCount(2);
        kotvy.Deviations.Should().HaveCount(1);
        kotvy.Notes.Should().Equal("Zvonit vzadu");
        model.Invoices.Should().HaveCount(2);
    }

    /// <summary>
    /// An empty file is the honest answer to "send me what changed" when nothing did — better than
    /// a full one the reader would have to diff by hand.
    /// </summary>
    [Fact]
    public void Apply_Changed_RunThatWentToPlan_CarriesNoInvoicePart()
    {
        var plan = ShipmentExportScopeFilter.Apply(Run(), ShipmentExportScope.Plan);

        var model = ShipmentExportScopeFilter.Apply(plan, ShipmentExportScope.Changed);

        model.Invoices.Should().BeEmpty();
        model.ShipmentName.Should().Be("Severní trasa");
    }

    /// <summary>
    /// Filtering hands back a new model rather than editing the one it was given — the endpoints
    /// stamp their rows off the same load.
    /// </summary>
    [Fact]
    public void Apply_LeavesTheGivenModelWhole()
    {
        var original = Run();

        ShipmentExportScopeFilter.Apply(original, ShipmentExportScope.Plan);
        ShipmentExportScopeFilter.Apply(original, ShipmentExportScope.Changed);

        PartyOf(original, "Hospoda U Kotvy").Products.Should().HaveCount(3);
        original.Invoices.Should().HaveCount(2);
    }
}
