using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Orders.Queries.Detail;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Order = AleTrack.Entities.Order;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// "Is this order's paperwork finished" — the one fact that opens recording a deviation against it.
/// </summary>
/// <remarks>
/// It is read in two places, the order detail and the shipment detail, and EF cannot share a
/// predicate between two projections — so the rule is written twice and this file is what stops the
/// copies drifting. Every case is asserted against <em>both</em> endpoints.
///
/// The case that matters most is the payer's: a sub-client has no Fakturace row of its own, so a
/// lookup keyed on the ordering client would leave every sub-client's order permanently
/// unrecordable, on both screens, with nothing failing to compile.
/// </remarks>
public sealed class InvoiceReadinessTests
{
    private const long PayerRowId = 90;
    private const long SubClientRowId = 91;
    private const long PlainClientRowId = 92;

    private sealed record Fixture(OutgoingShipment Shipment, Order Order, Client Client);

    /// <summary>
    /// One run, one stop, one order — with whatever confirmations the case needs.
    /// </summary>
    private static Fixture Build(
        Client client,
        OutgoingShipmentState state = OutgoingShipmentState.Loaded,
        params OutgoingShipmentInvoiceConfirmation[] confirmations)
    {
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, state: OrderState.Planning);
        order.ClientId = client.Id;

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            state: state,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        foreach (var confirmation in confirmations)
        {
            confirmation.OutgoingShipment = shipment;
            shipment.InvoiceConfirmations.Add(confirmation);
        }

        // Both ends of the stop link, because the mocked context does no navigation fixup: the
        // order screen reaches the run through stop.OutgoingShipment, and a null there reads as a
        // crash rather than as "not planned".
        var stop = shipment.Stops.First();
        stop.OutgoingShipment = shipment;
        order.OutgoingShipmentStop = stop;

        return new Fixture(shipment, order, client);
    }

    private static Client PlainClient() =>
        Client(PlainClientRowId, "Hospoda Sama", payer: null);

    private static Client Client(long id, string name, Client? payer)
    {
        var client = ClientBuilder.BuildEntity(
            publicId: Guid.NewGuid(), name: name, officialAddress: AddressBuilder.BuildEntity());
        client.Id = id;
        client.InvoicingClient = payer;
        client.InvoicingClientId = payer?.Id;
        return client;
    }

    private static OutgoingShipmentInvoiceConfirmation Row(long clientId, bool isReady, int number = 1) => new()
    {
        PublicId = Guid.NewGuid(),
        ClientId = clientId,
        Number = number,
        IsReady = isReady
    };

    /// <summary>The flag as the order screen reads it.</summary>
    private static async Task<bool> OnOrderDetailAsync(Fixture f, params Client[] clients)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: clients,
            orders: [f.Order],
            outgoingShipments: [f.Shipment]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(db.Object);

        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = f.Order.PublicId }, CancellationToken.None);

        return endpoint.Response.IsInvoiceReady;
    }

    /// <summary>The flag as the run's unload list reads it, for the stop carrying the order.</summary>
    private static async Task<bool> OnShipmentDetailAsync(Fixture f, params Client[] clients)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: clients,
            orders: [f.Order],
            outgoingShipments: [f.Shipment]);

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new GetOutgoingShipmentDetailRequest { Id = f.Shipment.PublicId }, CancellationToken.None);

        return endpoint.Response.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Order).IsInvoiceReady;
    }

    [Fact]
    public async Task RowMarkedFinished_IsReadyOnBothScreens()
    {
        var client = PlainClient();
        var f = Build(client, confirmations: Row(PlainClientRowId, isReady: true));

        (await OnOrderDetailAsync(f, client)).Should().BeTrue();
        (await OnShipmentDetailAsync(f, client)).Should().BeTrue();
    }

    [Fact]
    public async Task RowNotMarkedYet_IsNotReadyOnEitherScreen()
    {
        var client = PlainClient();
        var f = Build(client, confirmations: Row(PlainClientRowId, isReady: false));

        (await OnOrderDetailAsync(f, client)).Should().BeFalse();
        (await OnShipmentDetailAsync(f, client)).Should().BeFalse();
    }

    [Fact]
    public async Task NoRowAtAll_IsNotReadyOnEitherScreen()
    {
        var client = PlainClient();
        var f = Build(client);

        (await OnOrderDetailAsync(f, client)).Should().BeFalse();
        (await OnShipmentDetailAsync(f, client)).Should().BeFalse();
    }

    /// <summary>
    /// The case a lookup keyed on the ordering client gets wrong. A sub-client has no row of its
    /// own — confirming the payer confirms the whole group — so its order must read the payer's.
    /// </summary>
    [Fact]
    public async Task PayersRowMarkedFinished_CoversItsSubClientsOrder()
    {
        var payer = Client(PayerRowId, "Head Office", payer: null);
        var sub = Client(SubClientRowId, "Hospoda Pod Ním", payer);
        var f = Build(sub, confirmations: Row(PayerRowId, isReady: true));

        (await OnOrderDetailAsync(f, payer, sub)).Should().BeTrue();
        (await OnShipmentDetailAsync(f, payer, sub)).Should().BeTrue();
    }

    /// <summary>
    /// And the mirror of it: a row for the sub-client itself is not the row that covers the order,
    /// so it must not open recording either.
    /// </summary>
    [Fact]
    public async Task RowForTheSubClientItself_DoesNotCoverIt()
    {
        var payer = Client(PayerRowId, "Head Office", payer: null);
        var sub = Client(SubClientRowId, "Hospoda Pod Ním", payer);
        var f = Build(sub, confirmations: Row(SubClientRowId, isReady: true));

        (await OnOrderDetailAsync(f, payer, sub)).Should().BeFalse();
        (await OnShipmentDetailAsync(f, payer, sub)).Should().BeFalse();
    }

    [Fact]
    public async Task AnotherClientsFinishedRow_DoesNotCoverThisOrder()
    {
        var client = PlainClient();
        var other = Client(77, "Někdo Jiný", payer: null);
        var f = Build(client, confirmations: Row(other.Id, isReady: true));

        (await OnOrderDetailAsync(f, client, other)).Should().BeFalse();
        (await OnShipmentDetailAsync(f, client, other)).Should().BeFalse();
    }

    /// <summary>
    /// A cancelled run frees its orders back to planning, so there is no row to finish — and the
    /// order screen already drops the whole shipment section for one.
    /// </summary>
    [Fact]
    public async Task CancelledRun_IsNotReadyOnTheOrderScreen()
    {
        var client = PlainClient();
        var f = Build(client, OutgoingShipmentState.Cancelled, Row(PlainClientRowId, isReady: true));

        (await OnOrderDetailAsync(f, client)).Should().BeFalse();
    }

    /// <summary>
    /// The flag replaced a state check, so it must not have quietly become one: a finished row
    /// opens recording at every state the row can be ticked in, and keeps it open after delivery.
    /// </summary>
    [Theory]
    [InlineData(OutgoingShipmentState.Created)]
    [InlineData(OutgoingShipmentState.Loaded)]
    [InlineData(OutgoingShipmentState.InTransit)]
    [InlineData(OutgoingShipmentState.Delivered)]
    public async Task FinishedRow_IsReadyWhateverTheRunsState(OutgoingShipmentState state)
    {
        var client = PlainClient();
        var f = Build(client, state, Row(PlainClientRowId, isReady: true));

        (await OnOrderDetailAsync(f, client)).Should().BeTrue();
        (await OnShipmentDetailAsync(f, client)).Should().BeTrue();
    }

    /// <summary>
    /// An order on no run has no paperwork to finish. Its client's debts are still reachable from
    /// their profile, which is where a deviation with no delivery behind it belongs.
    /// </summary>
    [Fact]
    public async Task OrderOnNoRun_IsNotReady()
    {
        var client = PlainClient();
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, state: OrderState.New);
        order.ClientId = client.Id;

        var db = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(db.Object);

        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = order.PublicId }, CancellationToken.None);

        endpoint.Response.IsInvoiceReady.Should().BeFalse();
    }

    // ---------------------------------------------------------------------------------
    // The in-memory counterpart, for callers holding loaded entities.
    // ---------------------------------------------------------------------------------

    [Fact]
    public void RowClientIdOf_ResolvesThePayerWhenThereIsOne()
    {
        var payer = Client(PayerRowId, "Head Office", payer: null);
        var sub = Client(SubClientRowId, "Hospoda Pod Ním", payer);
        var order = OrderBuilder.BuildEntity(client: sub);
        order.ClientId = sub.Id;

        InvoiceReadiness.RowClientIdOf(order).Should().Be(PayerRowId);
    }

    [Fact]
    public void RowClientIdOf_FallsBackToTheOrderingClient()
    {
        var client = PlainClient();
        var order = OrderBuilder.BuildEntity(client: client);
        order.ClientId = client.Id;

        InvoiceReadiness.RowClientIdOf(order).Should().Be(PlainClientRowId);
    }

    [Fact]
    public void IsReadyFor_AgreesWithTheProjectedRule()
    {
        var payer = Client(PayerRowId, "Head Office", payer: null);
        var sub = Client(SubClientRowId, "Hospoda Pod Ním", payer);
        var f = Build(sub, confirmations: Row(PayerRowId, isReady: true));

        InvoiceReadiness.IsReadyFor(f.Shipment, f.Order).Should().BeTrue();
    }
}
