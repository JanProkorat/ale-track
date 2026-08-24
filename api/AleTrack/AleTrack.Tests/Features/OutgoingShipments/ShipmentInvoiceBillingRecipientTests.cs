using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.SetInvoiceBillingRecipients;
using AleTrack.Features.OutgoingShipments.Queries.Invoices;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The sub-clients a payer's invoice names as addresses to invoice: choosing them, and whether the
/// recorded address still follows the client.
/// </summary>
public sealed class ShipmentInvoiceBillingRecipientTests
{
    #region writing the selection

    [Fact]
    public async Task Set_SubClientsOfThePayer_RecordsThemWithTheirAddress()
    {
        var scenario = Scenario.Build();
        var dbContext = scenario.Mock();

        await Set(scenario, dbContext, [scenario.SubWithOrder.PublicId, scenario.SubWithoutOrder.PublicId]);

        var recipients = scenario.PayerInvoice.BillingRecipients;
        recipients.Should().HaveCount(2);
        recipients.Single(r => r.ClientId == Scenario.SubWithOrderId).Address.City.Should().Be("Brno");
        recipients.Single(r => r.ClientId == Scenario.SubWithoutOrderId).Address.City.Should().Be("Praha");
        dbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// The dropdown offers every sub-client of the payer, not only those with goods on this run —
    /// the payer may owe an address for something billed elsewhere.
    /// </summary>
    [Fact]
    public async Task Set_SubClientWithNoGoodsOnTheRun_IsAccepted()
    {
        var scenario = Scenario.Build();

        await Set(scenario, scenario.Mock(), [scenario.SubWithoutOrder.PublicId]);

        scenario.PayerInvoice.BillingRecipients.Should().ContainSingle()
            .Which.ClientId.Should().Be(Scenario.SubWithoutOrderId);
    }

    [Fact]
    public async Task Set_ReplacesTheWholeSelection()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), [scenario.SubWithOrder.PublicId]);

        var dbContext = scenario.Mock();
        await Set(scenario, dbContext, [scenario.SubWithoutOrder.PublicId]);

        scenario.PayerInvoice.BillingRecipients.Should().ContainSingle()
            .Which.ClientId.Should().Be(Scenario.SubWithoutOrderId);
        Mock.Get(dbContext.Object.OutgoingShipmentInvoiceBillingRecipients).Verify(
            s => s.RemoveRange(It.IsAny<IEnumerable<OutgoingShipmentInvoiceBillingRecipient>>()), Times.Once,
            "the deselected row is deleted, not orphaned");
    }

    [Fact]
    public async Task Set_EmptyList_ClearsTheSelection()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), [scenario.SubWithOrder.PublicId]);

        await Set(scenario, scenario.Mock(), []);

        scenario.PayerInvoice.BillingRecipients.Should().BeEmpty();
    }

    [Fact]
    public async Task Set_ClientNotBilledThroughThisPayer_IsRejected()
    {
        var scenario = Scenario.Build();

        var act = () => Set(scenario, scenario.Mock(), [scenario.Outsider.PublicId]);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
        scenario.PayerInvoice.BillingRecipients.Should().BeEmpty();
    }

    [Fact]
    public async Task Set_SubClientWithoutOfficialAddress_IsRejected()
    {
        var scenario = Scenario.Build();

        var act = () => Set(scenario, scenario.Mock(), [scenario.SubWithoutAddress.PublicId]);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
        scenario.PayerInvoice.BillingRecipients.Should().BeEmpty();
    }

    [Fact]
    public async Task Set_UnknownClient_IsNotFound()
    {
        var scenario = Scenario.Build();

        var act = () => Set(scenario, scenario.Mock(), [Guid.NewGuid()]);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task Set_UnknownInvoice_IsNotFound()
    {
        var scenario = Scenario.Build();

        var act = () => Set(scenario, scenario.Mock(), [scenario.SubWithOrder.PublicId], invoiceId: Guid.NewGuid());

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task Set_DeliveredShipment_IsRejected()
    {
        var scenario = Scenario.Build();
        scenario.Shipment.State = OutgoingShipmentState.Delivered;

        var act = () => Set(scenario, scenario.Mock(), [scenario.SubWithOrder.PublicId]);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    #endregion

    #region reading, and the freeze rule

    [Fact]
    public async Task Get_Recipient_CarriesTheClientIdentityAndAddress()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), [scenario.SubWithOrder.PublicId]);

        var recipient = (await GetInvoices(scenario)).Invoices
            .Single(i => i.ClientId == scenario.Payer.PublicId)
            .BillingRecipients.Should().ContainSingle().Subject;

        recipient.ClientId.Should().Be(scenario.SubWithOrder.PublicId);
        recipient.ClientName.Should().Be("Hospoda U Lípy");
        recipient.Address.StreetName.Should().Be("Hlavní");
        recipient.Address.City.Should().Be("Brno");
    }

    /// <summary>
    /// The office corrects a sub-client's address after the run is loaded but before it arrives —
    /// the payer must be handed the corrected one.
    /// </summary>
    [Fact]
    public async Task Get_RecordedAddress_FollowsTheClientWhileTheRunIsNotDelivered()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), [scenario.SubWithOrder.PublicId]);

        scenario.Shipment.State = OutgoingShipmentState.Loaded;
        scenario.SubWithOrder.OfficialAddress = Addr("Opravená", "9", "Zlín", "76001");

        var recipient = (await GetInvoices(scenario)).Invoices
            .Single(i => i.ClientId == scenario.Payer.PublicId)
            .BillingRecipients.Single();

        recipient.Address.StreetName.Should().Be("Opravená");
        recipient.Address.City.Should().Be("Zlín");
    }

    [Fact]
    public async Task Get_RecordedAddress_IsFrozenOnceTheRunIsDelivered()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), [scenario.SubWithOrder.PublicId]);

        scenario.Shipment.State = OutgoingShipmentState.Delivered;
        scenario.SubWithOrder.OfficialAddress = Addr("Opravená", "9", "Zlín", "76001");

        var recipient = (await GetInvoices(scenario)).Invoices
            .Single(i => i.ClientId == scenario.Payer.PublicId)
            .BillingRecipients.Single();

        recipient.Address.StreetName.Should().Be("Hlavní", "a delivered run keeps what it was invoiced with");
        recipient.Address.City.Should().Be("Brno");
    }

    #endregion

    #region pruning a severed payer link

    [Fact]
    public async Task Get_RecipientStillLinkedToThePayer_Survives()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), [scenario.SubWithOrder.PublicId]);

        var invoices = await GetInvoices(scenario);

        invoices.Invoices.Single(i => i.ClientId == scenario.Payer.PublicId)
            .BillingRecipients.Should().ContainSingle()
            .Which.ClientId.Should().Be(scenario.SubWithOrder.PublicId);
    }

    /// <summary>
    /// If the sub-client's payer link is later removed, the recipient row must go with it — a
    /// surviving row would tell the payer to invoice a client that is no longer theirs.
    /// </summary>
    [Fact]
    public async Task Get_RecipientWhosePayerLinkWasRemoved_IsDroppedWhileEditable()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), [scenario.SubWithOrder.PublicId]);

        scenario.SubWithOrder.InvoicingClientId = null;
        scenario.SubWithOrder.InvoicingClient = null;

        var invoices = await GetInvoices(scenario);

        invoices.Invoices.Single(i => i.ClientId == scenario.Payer.PublicId)
            .BillingRecipients.Should().BeEmpty("the client is no longer billed through this payer");
    }

    [Fact]
    public async Task Get_RecipientWhosePayerLinkWasRemoved_SurvivesUntouchedOnDeliveredShipment()
    {
        var scenario = Scenario.Build();
        await Set(scenario, scenario.Mock(), [scenario.SubWithOrder.PublicId]);

        scenario.SubWithOrder.InvoicingClientId = null;
        scenario.SubWithOrder.InvoicingClient = null;
        scenario.Shipment.State = OutgoingShipmentState.Delivered;

        var invoices = await GetInvoices(scenario);

        invoices.Invoices.Single(i => i.ClientId == scenario.Payer.PublicId)
            .BillingRecipients.Should().ContainSingle("history stays exactly as it was sent")
            .Which.ClientId.Should().Be(scenario.SubWithOrder.PublicId);
    }

    #endregion

    #region helpers

    private static async Task Set(
        Scenario scenario,
        Mock<AleTrackDbContext> dbContext,
        List<Guid> clientIds,
        Guid? invoiceId = null)
    {
        var endpoint = EndpointBuilder<SetInvoiceBillingRecipientsRequest, SetInvoiceBillingRecipientsEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new SetInvoiceBillingRecipientsRequest
        {
            Id = scenario.ShipmentId,
            InvoiceId = invoiceId ?? scenario.PayerInvoice.PublicId,
            Data = new SetInvoiceBillingRecipientsDto { ClientIds = clientIds }
        }, CancellationToken.None);
    }

    private static async Task<ShipmentInvoicesDto> GetInvoices(Scenario scenario)
    {
        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto, GetShipmentInvoicesEndpoint>
            .Create(scenario.Mock().Object, DriverScopeMockFactory.Unscoped());
        await endpoint.HandleAsync(new GetShipmentInvoicesRequest { Id = scenario.ShipmentId }, CancellationToken.None);
        return endpoint.Response;
    }

    private static Address Addr(string street, string number, string city, string zip) =>
        new() { StreetName = street, StreetNumber = number, City = city, Zip = zip, Country = Country.Czechia };

    /// <summary>
    /// A payer with three sub-clients — one ordering on this run, one not, one with no official
    /// address — plus an unrelated client, and the payer's materialised invoice.
    /// </summary>
    private sealed class Scenario
    {
        internal const long PayerId = 1;
        internal const long SubWithOrderId = 2;
        internal const long SubWithoutOrderId = 3;
        internal const long SubWithoutAddressId = 4;
        internal const long OutsiderId = 5;

        internal required OutgoingShipment Shipment { get; init; }
        internal required Client Payer { get; init; }
        internal required Client SubWithOrder { get; init; }
        internal required Client SubWithoutOrder { get; init; }
        internal required Client SubWithoutAddress { get; init; }
        internal required Client Outsider { get; init; }

        internal Guid ShipmentId => Shipment.PublicId;

        internal OutgoingShipmentInvoice PayerInvoice => Shipment.Invoices.Single(i => i.ClientId == PayerId);

        internal Mock<AleTrackDbContext> Mock() =>
            AleTrackDbContextMockFactory.CreateMock(
                clients: [Payer, SubWithOrder, SubWithoutOrder, SubWithoutAddress, Outsider],
                outgoingShipments: [Shipment],
                outgoingShipmentInvoices: Shipment.Invoices.ToList(),
                outgoingShipmentInvoiceLines: Shipment.Invoices.SelectMany(i => i.Lines).ToList(),
                outgoingShipmentInvoiceBillingRecipients: Shipment.Invoices.SelectMany(i => i.BillingRecipients).ToList());

        internal static Scenario Build()
        {
            var payer = new Client
            {
                Id = PayerId, PublicId = Guid.NewGuid(), Name = "Head Office",
                OfficialAddress = Addr("Centrální", "1", "Ostrava", "70200")
            };
            var subWithOrder = new Client
            {
                Id = SubWithOrderId, PublicId = Guid.NewGuid(), Name = "Hospoda U Lípy",
                InvoicingClientId = PayerId, InvoicingClient = payer,
                OfficialAddress = Addr("Hlavní", "12", "Brno", "60200")
            };
            var subWithoutOrder = new Client
            {
                Id = SubWithoutOrderId, PublicId = Guid.NewGuid(), Name = "Bar Na Rohu",
                InvoicingClientId = PayerId, InvoicingClient = payer,
                OfficialAddress = Addr("Nádražní", "5", "Praha", "11000")
            };
            var subWithoutAddress = new Client
            {
                Id = SubWithoutAddressId, PublicId = Guid.NewGuid(), Name = "Stánek",
                InvoicingClientId = PayerId, InvoicingClient = payer
            };
            // Has an address of its own, so the payer rule is what rejects it rather than a missing one.
            var outsider = new Client
            {
                Id = OutsiderId, PublicId = Guid.NewGuid(), Name = "Cizí klient",
                OfficialAddress = Addr("Vedlejší", "3", "Plzeň", "30100")
            };

            var product = new Product
            {
                Id = 900, PublicId = Guid.NewGuid(), Name = "Ležák 11°",
                Kind = ProductKind.Keg, Type = ProductType.PaleLager, PlatoDegree = 11,
                PackageSize = 30, PriceWithVat = 100m
            };
            var item = new OrderItem
            {
                Id = 1, PublicId = Guid.NewGuid(), Quantity = 4, ProductId = product.Id, Product = product
            };

            var shipment = new OutgoingShipment
            {
                PublicId = Guid.NewGuid(), Name = "Rozvoz", State = OutgoingShipmentState.Created
            };
            shipment.Stops.Add(new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(), Kind = OutgoingShipmentStopKind.Order, Order = 1,
                OutgoingShipment = shipment,
                ClientOrder = new Order
                {
                    Id = 101, PublicId = Guid.NewGuid(), ClientId = SubWithOrderId, Client = subWithOrder,
                    OrderItems = [item]
                }
            });

            // The payer's invoice is what the selection hangs off, so materialise the default split.
            ShipmentInvoiceReconciler.Reconcile(ShipmentInvoiceSplit.Of(shipment));

            return new Scenario
            {
                Shipment = shipment, Payer = payer, SubWithOrder = subWithOrder,
                SubWithoutOrder = subWithoutOrder, SubWithoutAddress = subWithoutAddress, Outsider = outsider
            };
        }
    }

    #endregion
}
