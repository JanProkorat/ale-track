using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.SetInvoiceReadiness;
using AleTrack.Features.OutgoingShipments.Queries.Invoices;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Marking one client's Fakturace row as finished: which rows may be marked, and the numbering
/// that marking hands out.
/// </summary>
public sealed class ShipmentInvoiceReadinessTests
{
    #region numbering

    [Fact]
    public async Task Set_FirstRowMarkedReady_TakesNumberOne()
    {
        var scenario = Scenario.Build();

        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true);

        var confirmation = scenario.ConfirmationOf(Scenario.LvaId);
        confirmation.Number.Should().Be(1);
        confirmation.IsReady.Should().BeTrue();
    }

    /// <summary>
    /// The number follows the order the office confirms rows in, not the route: U Lva is second on
    /// the route and still takes 1 by being marked first.
    /// </summary>
    [Fact]
    public async Task Set_SecondRowMarkedReady_TakesNumberTwo()
    {
        var scenario = Scenario.Build();

        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true);
        await Set(scenario, scenario.Mock(), scenario.Beseda.PublicId, isReady: true);

        scenario.ConfirmationOf(Scenario.LvaId).Number.Should().Be(1);
        scenario.ConfirmationOf(Scenario.BesedaId).Number.Should().Be(2);
    }

    [Fact]
    public async Task Set_UnmarkedRow_KeepsItsNumber()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true);

        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: false);

        var confirmation = scenario.ConfirmationOf(Scenario.LvaId);
        confirmation.IsReady.Should().BeFalse();
        confirmation.Number.Should().Be(1, "re-marking has to give the same number back");
    }

    [Fact]
    public async Task Set_RemarkedRow_GetsTheSameNumberBack()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true);
        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: false);

        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true);

        scenario.ConfirmationOf(Scenario.LvaId).Number.Should().Be(1);
        scenario.Shipment.InvoiceConfirmations.Should().ContainSingle("re-marking must not open a second row");
    }

    /// <summary>
    /// An un-marked row still holds its number, so the next client marked takes the number after
    /// it rather than stepping into the gap.
    /// </summary>
    [Fact]
    public async Task Set_AfterAnUnmark_NextRowTakesTheFollowingNumber()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true);
        await Set(scenario, scenario.Mock(), scenario.Beseda.PublicId, isReady: true);
        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: false);

        await Set(scenario, scenario.Mock(), scenario.Kout.PublicId, isReady: true);

        scenario.ConfirmationOf(Scenario.KoutId).Number.Should().Be(3);
    }

    [Fact]
    public async Task Set_ReadyTwiceOnTheSameRow_ChangesNothing()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true);
        await Set(scenario, scenario.Mock(), scenario.Beseda.PublicId, isReady: true);

        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true);

        scenario.ConfirmationOf(Scenario.LvaId).Number.Should().Be(1);
        scenario.Shipment.InvoiceConfirmations.Should().HaveCount(2);
    }

    [Fact]
    public async Task Set_ClearingARowThatWasNeverMarked_ChangesNothing()
    {
        var scenario = Scenario.Build();

        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: false);

        scenario.Shipment.InvoiceConfirmations.Should().BeEmpty("clearing must not hand out a number");
    }

    [Fact]
    public async Task Set_Ready_IsPersisted()
    {
        var scenario = Scenario.Build();
        var dbContext = scenario.Mock();

        await Set(scenario, dbContext, scenario.Lva.PublicId, isReady: true);

        dbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region which rows may be marked

    /// <summary>
    /// A payer is a row of its own — it holds the group's invoice — even with no delivery on the
    /// run, and marking it is what confirms the whole group at once.
    /// </summary>
    [Fact]
    public async Task Set_PayerHoldingTheGroupsInvoice_IsAccepted()
    {
        var scenario = Scenario.Build();

        await Set(scenario, scenario.Mock(), scenario.Payer.PublicId, isReady: true);

        scenario.ConfirmationOf(Scenario.PayerId).Number.Should().Be(1);
    }

    /// <summary>
    /// The sub-client's goods are billed on its payer's invoice, so it has no row of its own —
    /// marking it would hand a number to a client the export never prints, and would let a group
    /// be confirmed piecemeal.
    /// </summary>
    [Fact]
    public async Task Set_SubClientBilledThroughItsPayer_IsNotFound()
    {
        var scenario = Scenario.Build();

        var act = () => Set(scenario, scenario.Mock(), scenario.Sub.PublicId, isReady: true);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
        scenario.Shipment.InvoiceConfirmations.Should().BeEmpty();
    }

    [Fact]
    public async Task Set_ClientWithNothingOnTheRun_IsNotFound()
    {
        var scenario = Scenario.Build();

        var act = () => Set(scenario, scenario.Mock(), scenario.Outsider.PublicId, isReady: true);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task Set_UnknownShipment_IsNotFound()
    {
        var scenario = Scenario.Build();

        var act = () => Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true, shipmentId: Guid.NewGuid());

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task Set_DeliveredShipment_IsRejected()
    {
        var scenario = Scenario.Build();
        scenario.Shipment.State = OutgoingShipmentState.Delivered;

        var act = () => Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
        scenario.Shipment.InvoiceConfirmations.Should().BeEmpty();
    }

    #endregion

    #region reading

    [Fact]
    public async Task Get_MarkedRow_ReportsItsNumberAndReadiness()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true);

        var confirmation = (await GetInvoices(scenario)).Confirmations.Should().ContainSingle().Subject;

        confirmation.ClientId.Should().Be(scenario.Lva.PublicId);
        confirmation.Number.Should().Be(1);
        confirmation.IsReady.Should().BeTrue();
    }

    [Fact]
    public async Task Get_UnmarkedRow_ReportsItsKeptNumberAsNotReady()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: true);
        await Set(scenario, scenario.Mock(), scenario.Lva.PublicId, isReady: false);

        var confirmation = (await GetInvoices(scenario)).Confirmations.Should().ContainSingle().Subject;

        confirmation.Number.Should().Be(1);
        confirmation.IsReady.Should().BeFalse();
    }

    [Fact]
    public async Task Get_RowNeverMarked_IsAbsent()
    {
        var scenario = Scenario.Build();

        (await GetInvoices(scenario)).Confirmations.Should().BeEmpty();
    }

    #endregion

    #region helpers

    private static async Task Set(
        Scenario scenario,
        Mock<AleTrackDbContext> dbContext,
        Guid clientId,
        bool isReady,
        Guid? shipmentId = null)
    {
        var endpoint = EndpointBuilder<SetInvoiceReadinessRequest, SetInvoiceReadinessEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new SetInvoiceReadinessRequest
        {
            Id = shipmentId ?? scenario.ShipmentId,
            ClientId = clientId,
            Data = new SetInvoiceReadinessDto { IsReady = isReady }
        }, CancellationToken.None);
    }

    private static async Task<ShipmentInvoicesDto> GetInvoices(Scenario scenario)
    {
        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto, GetShipmentInvoicesEndpoint>
            .Create(scenario.Mock().Object, DriverScopeMockFactory.Unscoped());
        await endpoint.HandleAsync(new GetShipmentInvoicesRequest { Id = scenario.ShipmentId }, CancellationToken.None);
        return endpoint.Response;
    }

    /// <summary>
    /// A run with three ordinary clients on the route, plus a sub-client whose goods are billed to
    /// a payer with no delivery of its own, and an unrelated client that is not on the run at all.
    /// </summary>
    private sealed class Scenario
    {
        internal const long KoutId = 1;
        internal const long LvaId = 2;
        internal const long BesedaId = 3;
        internal const long PayerId = 4;
        internal const long SubId = 5;
        internal const long OutsiderId = 6;

        internal required OutgoingShipment Shipment { get; init; }
        internal required Client Kout { get; init; }
        internal required Client Lva { get; init; }
        internal required Client Beseda { get; init; }
        internal required Client Payer { get; init; }
        internal required Client Sub { get; init; }
        internal required Client Outsider { get; init; }

        internal Guid ShipmentId => Shipment.PublicId;

        internal OutgoingShipmentInvoiceConfirmation ConfirmationOf(long clientId) =>
            Shipment.InvoiceConfirmations.Single(c => c.ClientId == clientId);

        internal Mock<AleTrackDbContext> Mock() =>
            AleTrackDbContextMockFactory.CreateMock(
                clients: [Kout, Lva, Beseda, Payer, Sub, Outsider],
                outgoingShipments: [Shipment],
                outgoingShipmentInvoices: Shipment.Invoices.ToList(),
                outgoingShipmentInvoiceLines: Shipment.Invoices.SelectMany(i => i.Lines).ToList(),
                outgoingShipmentInvoiceConfirmations: Shipment.InvoiceConfirmations.ToList());

        internal static Scenario Build()
        {
            var kout = new Client { Id = KoutId, PublicId = Guid.NewGuid(), Name = "Pivovar Kout" };
            var lva = new Client { Id = LvaId, PublicId = Guid.NewGuid(), Name = "Hospoda U Lva" };
            var beseda = new Client { Id = BesedaId, PublicId = Guid.NewGuid(), Name = "Beseda" };
            var payer = new Client { Id = PayerId, PublicId = Guid.NewGuid(), Name = "Head Office" };
            var sub = new Client
            {
                Id = SubId, PublicId = Guid.NewGuid(), Name = "Hospoda U Lípy",
                InvoicingClientId = PayerId, InvoicingClient = payer
            };
            var outsider = new Client { Id = OutsiderId, PublicId = Guid.NewGuid(), Name = "Cizí klient" };

            var shipment = new OutgoingShipment
            {
                PublicId = Guid.NewGuid(), Name = "Rozvoz", State = OutgoingShipmentState.Created
            };

            var order = 1;
            foreach (var client in new[] { kout, lva, beseda, sub })
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

            // Materialise the default split, so every client's row exists the way the Fakturace
            // screen has already made it exist by the time anyone ticks a box.
            ShipmentInvoiceReconciler.Reconcile(ShipmentInvoiceSplit.Of(shipment));

            return new Scenario
            {
                Shipment = shipment, Kout = kout, Lva = lva, Beseda = beseda,
                Payer = payer, Sub = sub, Outsider = outsider
            };
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
