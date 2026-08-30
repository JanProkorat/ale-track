using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Export;
using AleTrack.Features.OutgoingShipments.Queries.Invoices;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Choosing which confirmed rows an export carries, and the stamp it leaves on the ones it did.
/// </summary>
public sealed class ExportSelectionTests
{
    private static readonly DateTime ExportedAt = new(2026, 8, 23, 20, 15, 0, DateTimeKind.Utc);

    private static readonly CompanyOptions Company = new()
    {
        Name = "AleTrack s.r.o.",
        StreetName = "Skladová",
        StreetNumber = "7",
        Zip = "460 01",
        City = "Liberec",
        Country = Country.Czechia
    };

    #region what the file carries

    [Fact]
    public async Task Export_OneOfTwoConfirmedRows_StampsOnlyTheChosenOne()
    {
        var scenario = Scenario.Build();

        await ExportExcel(scenario, [scenario.Lva.PublicId]);

        scenario.ConfirmationOf(Scenario.LvaId).LastExportedAt.Should().Be(ExportedAt);
        scenario.ConfirmationOf(Scenario.KoutId).LastExportedAt
            .Should().BeNull("the row nobody chose did not go into this file");
    }

    [Fact]
    public async Task Export_Selection_IsPersisted()
    {
        var scenario = Scenario.Build();
        var dbContext = scenario.Mock();

        await ExportExcel(scenario, [scenario.Lva.PublicId], dbContext);

        dbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Export_RowThatWentOutBefore_HasItsStampRefreshed()
    {
        var scenario = Scenario.Build();
        scenario.ConfirmationOf(Scenario.LvaId).LastExportedAt = new DateTime(2026, 8, 1, 6, 0, 0, DateTimeKind.Utc);

        await ExportExcel(scenario, [scenario.Lva.PublicId]);

        scenario.ConfirmationOf(Scenario.LvaId).LastExportedAt
            .Should().Be(ExportedAt, "the last export is the one the office is holding");
    }

    [Fact]
    public async Task Export_Word_StampsTheSameWayTheWorkbookDoes()
    {
        var scenario = Scenario.Build();

        await ExportWord(scenario, [scenario.Kout.PublicId]);

        scenario.ConfirmationOf(Scenario.KoutId).LastExportedAt.Should().Be(ExportedAt);
    }

    #endregion

    #region what may be chosen

    [Fact]
    public async Task Export_EmptySelection_IsRejected()
    {
        var scenario = Scenario.Build();

        var act = () => ExportExcel(scenario, []);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    /// <summary>
    /// An unconfirmed row has nothing in the file, so exporting it would hand back a file missing
    /// the section the caller asked for — the one failure the office cannot see.
    /// </summary>
    [Fact]
    public async Task Export_ClientWithNoConfirmedRow_IsRejected()
    {
        var scenario = Scenario.Build();
        scenario.Shipment.InvoiceConfirmations.Remove(scenario.ConfirmationOf(Scenario.KoutId));

        var act = () => ExportExcel(scenario, [scenario.Kout.PublicId]);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task Export_RowConfirmedButSinceUnticked_IsRejected()
    {
        var scenario = Scenario.Build();
        scenario.ConfirmationOf(Scenario.KoutId).IsReady = false;

        var act = () => ExportExcel(scenario, [scenario.Kout.PublicId]);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task Export_UnknownShipment_IsNotFoundAndStampsNothing()
    {
        var scenario = Scenario.Build();

        var act = () => ExportExcel(scenario, [scenario.Lva.PublicId], shipmentId: Guid.NewGuid());

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
        scenario.Shipment.InvoiceConfirmations.Should().OnlyContain(c => c.LastExportedAt == null);
    }

    #endregion

    #region the file itself

    [Fact]
    public async Task Load_Selection_KeepsOnlyTheChosenRowsSections()
    {
        var scenario = Scenario.Build();

        var model = await ShipmentExportQuery.LoadAsync(
            scenario.Mock().Object, scenario.ShipmentId, Company, [scenario.Lva.PublicId], CancellationToken.None);

        model!.Invoices.Select(i => i.PayingClientName).Should().Equal("Hospoda U Lva");
        model.Stops.Should().HaveCount(2, "the route table is the driver's page and stays whole");
    }

    [Fact]
    public async Task Load_NoSelection_KeepsEveryConfirmedRow()
    {
        var scenario = Scenario.Build();

        var model = await ShipmentExportQuery.LoadAsync(
            scenario.Mock().Object, scenario.ShipmentId, Company, null, CancellationToken.None);

        model!.Invoices.Select(i => i.Number).Should().Equal(1, 2);
    }

    #endregion

    #region reading the stamp

    [Fact]
    public async Task Get_ExportedRow_ReportsWhenItWentOut()
    {
        var scenario = Scenario.Build();
        await ExportExcel(scenario, [scenario.Lva.PublicId]);

        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto,
                GetShipmentInvoicesEndpoint>
            .Create(scenario.Mock().Object, DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(
            new GetShipmentInvoicesRequest { Id = scenario.ShipmentId }, CancellationToken.None);

        var confirmations = endpoint.Response.Confirmations;
        confirmations.Single(c => c.ClientId == scenario.Lva.PublicId).LastExportedAt.Should().Be(ExportedAt);
        confirmations.Single(c => c.ClientId == scenario.Kout.PublicId).LastExportedAt.Should().BeNull();
    }

    /// <summary>
    /// The scope reaches the writer: asked for the corrections of a run that went to plan, the file
    /// has no invoice part to write, while the plan still has one.
    /// </summary>
    /// <remarks>
    /// Through the selector rather than the endpoint, because the endpoint hands its bytes to the
    /// response and a test cannot read a spreadsheet back out of it. What is being pinned is the
    /// wiring — that the request's scope is what the model was narrowed by — and the scopes' own
    /// meanings are pinned in ShipmentExportScopeFilterTests.
    /// </remarks>
    [Fact]
    public async Task Load_ChangedScope_RunThatWentToPlan_CarriesNoInvoicePart()
    {
        var scenario = Scenario.Build();

        var plan = await Load(scenario, ShipmentExportScope.Plan);
        var changed = await Load(scenario, ShipmentExportScope.Changed);

        plan.Model.Invoices.Should().NotBeEmpty();
        plan.Scope.Should().Be(ShipmentExportScope.Plan);

        changed.Model.Invoices.Should().BeEmpty();
        changed.Scope.Should().Be(ShipmentExportScope.Changed);
    }

    /// <summary>
    /// Naming no scope keeps the file the office already knows.
    /// </summary>
    [Fact]
    public async Task Load_NoScope_IsThePlan()
    {
        var selection = await Load(Scenario.Build(), null);

        selection.Scope.Should().Be(ShipmentExportScope.Plan);
    }

    #endregion

    #region helpers

    private static Task<ShipmentExportSelection> Load(Scenario scenario, ShipmentExportScope? scope)
    {
        var request = Request(scenario, [scenario.Lva.PublicId], null);

        if (scope is not null)
            request.Data.Scope = scope.Value;

        return ShipmentExportSelector.LoadAsync(
            scenario.Mock().Object, request, Company, CancellationToken.None);
    }

    private static Task ExportExcel(
        Scenario scenario,
        List<Guid> clientIds,
        Mock<AleTrackDbContext>? dbContext = null,
        Guid? shipmentId = null)
    {
        var endpoint = EndpointBuilder<ExportOutgoingShipmentRequest, ExportOutgoingShipmentExcelEndpoint>
            .Create(
                (dbContext ?? scenario.Mock()).Object,
                Options.Create(Company),
                DriverScopeMockFactory.Unscoped(),
                Clock());

        endpoint.HttpContext.Response.Body = new MemoryStream();

        return endpoint.HandleAsync(Request(scenario, clientIds, shipmentId), CancellationToken.None);
    }

    private static Task ExportWord(Scenario scenario, List<Guid> clientIds)
    {
        var endpoint = EndpointBuilder<ExportOutgoingShipmentRequest, ExportOutgoingShipmentWordEndpoint>
            .Create(scenario.Mock().Object, Options.Create(Company), DriverScopeMockFactory.Unscoped(), Clock());

        endpoint.HttpContext.Response.Body = new MemoryStream();

        return endpoint.HandleAsync(Request(scenario, clientIds, null), CancellationToken.None);
    }

    private static ExportOutgoingShipmentRequest Request(Scenario scenario, List<Guid> clientIds, Guid? shipmentId) =>
        new()
        {
            Id = shipmentId ?? scenario.ShipmentId,
            Data = new ExportOutgoingShipmentDto { ClientIds = clientIds }
        };

    private static TimeProvider Clock() => new FixedClock(ExportedAt);

    /// <summary>
    /// A clock stopped at one instant, so the stamp a test asserts on is the stamp the endpoint
    /// wrote. Hand-rolled rather than pulling in Microsoft.Extensions.TimeProvider.Testing for four
    /// lines.
    /// </summary>
    private sealed class FixedClock(DateTime utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(utcNow, TimeSpan.Zero);
    }

    /// <summary>
    /// A run with two ordinary clients, each ordering for itself, both rows confirmed — Lva first.
    /// </summary>
    private sealed class Scenario
    {
        internal const long KoutId = 1;
        internal const long LvaId = 2;

        internal required OutgoingShipment Shipment { get; init; }
        internal required Client Kout { get; init; }
        internal required Client Lva { get; init; }

        internal Guid ShipmentId => Shipment.PublicId;

        internal OutgoingShipmentInvoiceConfirmation ConfirmationOf(long clientId) =>
            Shipment.InvoiceConfirmations.Single(c => c.ClientId == clientId);

        internal Mock<AleTrackDbContext> Mock() =>
            AleTrackDbContextMockFactory.CreateMock(
                clients: [Kout, Lva],
                outgoingShipments: [Shipment],
                outgoingShipmentInvoices: Shipment.Invoices.ToList(),
                outgoingShipmentInvoiceLines: Shipment.Invoices.SelectMany(i => i.Lines).ToList(),
                outgoingShipmentInvoiceConfirmations: Shipment.InvoiceConfirmations.ToList());

        internal static Scenario Build()
        {
            var kout = new Client { Id = KoutId, PublicId = Guid.NewGuid(), Name = "Pivovar Kout" };
            var lva = new Client { Id = LvaId, PublicId = Guid.NewGuid(), Name = "Hospoda U Lva" };

            var shipment = new OutgoingShipment
            {
                Id = 900, PublicId = Guid.NewGuid(), Name = "Rozvoz", State = OutgoingShipmentState.Created
            };

            var order = 1;
            foreach (var client in new[] { kout, lva })
            {
                shipment.Stops.Add(new OutgoingShipmentStop
                {
                    PublicId = Guid.NewGuid(), Kind = OutgoingShipmentStopKind.Order, Order = order,
                    OutgoingShipment = shipment,
                    ClientOrder = new Order
                    {
                        Id = 100 + order, PublicId = Guid.NewGuid(), ClientId = client.Id, Client = client,
                        OrderItems = [Item(order)]
                    }
                });
                order++;
            }

            ShipmentInvoiceReconciler.Reconcile(ShipmentInvoiceSplit.Of(shipment));

            // Confirmed in the order the office ticked them: Lva first, so its number leads Kout's.
            var number = 1;
            foreach (var client in new[] { lva, kout })
            {
                shipment.InvoiceConfirmations.Add(new OutgoingShipmentInvoiceConfirmation
                {
                    PublicId = Guid.NewGuid(),
                    OutgoingShipment = shipment,
                    OutgoingShipmentId = shipment.Id,
                    ClientId = client.Id,
                    Client = client,
                    Number = number++,
                    IsReady = true
                });
            }

            return new Scenario { Shipment = shipment, Kout = kout, Lva = lva };
        }

        private static OrderItem Item(int seed)
        {
            var product = new Product
            {
                Id = 900 + seed, PublicId = Guid.NewGuid(), Name = $"Ležák {seed}",
                Kind = ProductKind.Keg, Type = ProductType.PaleLager, PlatoDegree = 11,
                PackageSize = 30, PriceWithVat = 100m
            };

            return new OrderItem
            {
                Id = seed, PublicId = Guid.NewGuid(), Quantity = 4, ProductId = product.Id, Product = product
            };
        }
    }

    #endregion
}
