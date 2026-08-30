using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.Orders.Utils;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;
using Client = AleTrack.Entities.Client;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// A change of destination is recorded automatically, from both write paths — the order's
/// address propagating to its stop, and the planner moving the stop on the run — because to the
/// client they are the same event. The dispatcher never types it, and never types it twice.
/// </summary>
public sealed class ClientLedgerAddressTests
{
    private static readonly DateTime Now = new(2026, 8, 24, 10, 0, 0, DateTimeKind.Utc);

    private const long ClientRowId = 11;
    private const long OrderRowId = 21;
    private const long StopRowId = 31;

    private sealed record Fixture(
        Client Client,
        Order Order,
        OutgoingShipmentStop Stop,
        OutgoingShipment Shipment,
        Vehicle Vehicle,
        Driver Driver);

    /// <summary>
    /// An order planned onto a stop, its own address already moved to the client's contact
    /// address while the stop still points at the official one.
    /// </summary>
    private static Fixture Planned(OutgoingShipmentState shipmentState, bool overridden = false)
    {
        var client = ClientBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            officialAddress: AddressBuilder.BuildEntity(streetName: "Dlouhá", streetNumber: "1", city: "Liberec", zip: "46001"),
            contactAddress: AddressBuilder.BuildEntity(streetName: "Krátká", streetNumber: "2", city: "Liberec", zip: "46002"));
        client.Id = ClientRowId;

        var order = OrderBuilder.BuildEntity(client: client, state: OrderState.Delivering);
        order.Id = OrderRowId;
        order.ClientId = client.Id;
        order.DeliveryAddressKind = DeliveryAddressKind.Contact;

        // A run that already satisfies HasFilledData, or the pre-existing "not prepared" check
        // would reject every save past Created before the ledger is even reached.
        var vehicle = VehicleBuilder.BuildEntity(publicId: Guid.NewGuid());
        vehicle.Id = 81;
        var driver = DriverBuilder.BuildEntity(publicId: Guid.NewGuid());

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            deliveryDate: new DateTime(2026, 8, 25, 6, 0, 0, DateTimeKind.Utc),
            state: shipmentState,
            vehicle: vehicle,
            drivers: [new OutgoingShipmentDriver { Driver = driver }]);
        shipment.VehicleId = vehicle.Id;

        var stop = new OutgoingShipmentStop
        {
            Id = StopRowId,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            ClientOrder = order,
            OutgoingShipment = shipment,
            SelectedAddressKind = DeliveryAddressKind.Official,
            IsAddressOverridden = overridden
        };
        shipment.Stops.Add(stop);
        order.OutgoingShipmentStop = stop;

        return new Fixture(client, order, stop, shipment, vehicle, driver);
    }

    private sealed record Harness(
        Mock<AleTrackDbContext> Db,
        List<ClientLedgerEntry> Added,
        List<ClientLedgerEntry> Removed);

    private static Harness BuildHarness(Fixture f, params ClientLedgerEntry[] stored)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            orders: [f.Order],
            outgoingShipments: [f.Shipment],
            vehicles: [f.Vehicle],
            drivers: [f.Driver],
            clientLedgerEntries: [.. stored]);

        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var added = new List<ClientLedgerEntry>();
        var removed = new List<ClientLedgerEntry>();
        db.Setup(x => x.ClientLedgerEntries.Add(It.IsAny<ClientLedgerEntry>())).Callback<ClientLedgerEntry>(added.Add);
        db.Setup(x => x.ClientLedgerEntries.Remove(It.IsAny<ClientLedgerEntry>())).Callback<ClientLedgerEntry>(removed.Add);

        return new Harness(db, added, removed);
    }

    private static ClientLedgerEntry StoredAddressEntry(string planned, string actual) => new()
    {
        Id = 201,
        PublicId = Guid.NewGuid(),
        ClientId = ClientRowId,
        OrderId = OrderRowId,
        StopId = StopRowId,
        Target = ClientLedgerEntryTarget.DeliveryAddress,
        PlannedText = planned,
        ActualText = actual,
        RequiresFollowUp = false,
        CreatedAt = Now.AddHours(-1)
    };

    // ---------------------------------------------------------------------------------
    // Path 1: the order's address is edited and propagates to the stop.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task Propagate_UnderARunningShipment_RecordsWhereItWasSupposedToGo()
    {
        var f = Planned(OutgoingShipmentState.InTransit);
        var h = BuildHarness(f);

        await OrderDeliveryAddressWriter.PropagateToStopAsync(h.Db.Object, f.Order, Now, CancellationToken.None);

        var entry = h.Added.Should().ContainSingle().Subject;
        entry.Target.Should().Be(ClientLedgerEntryTarget.DeliveryAddress);
        entry.RequiresFollowUp.Should().BeFalse("driving elsewhere is a record, not a debt");
        entry.PlannedText.Should().Be("Dlouhá 1, 46001 Liberec");
        entry.ActualText.Should().Be("Krátká 2, 46002 Liberec");
        entry.StopId.Should().Be(StopRowId);
        entry.OrderId.Should().Be(OrderRowId);

        f.Stop.AddressChangedAt.Should().Be(Now, "the banner keeps working exactly as before");
    }

    [Fact]
    public async Task Propagate_WhileTheRunIsStillCreated_RecordsNothing()
    {
        var f = Planned(OutgoingShipmentState.Created);
        var h = BuildHarness(f);

        await OrderDeliveryAddressWriter.PropagateToStopAsync(h.Db.Object, f.Order, Now, CancellationToken.None);

        h.Added.Should().BeEmpty("nothing has been promised yet — this is still planning");
        f.Stop.AddressChangedAt.Should().Be(Now);
    }

    /// <summary>
    /// The planner's override wins, so the stop keeps its address: nothing moved for the client
    /// and there is nothing to record — even though the divergence is still announced.
    /// </summary>
    [Fact]
    public async Task Propagate_OverriddenStopKeepingItsAddress_RecordsNothing()
    {
        var f = Planned(OutgoingShipmentState.InTransit, overridden: true);
        var h = BuildHarness(f);

        await OrderDeliveryAddressWriter.PropagateToStopAsync(h.Db.Object, f.Order, Now, CancellationToken.None);

        h.Added.Should().BeEmpty();
        f.Stop.SelectedAddressKind.Should().Be(DeliveryAddressKind.Official);
        f.Stop.AddressChangedAt.Should().Be(Now);
    }

    [Theory]
    [InlineData(OutgoingShipmentState.Delivered)]
    [InlineData(OutgoingShipmentState.Cancelled)]
    public async Task Propagate_ClosedShipment_RecordsNothing(OutgoingShipmentState state)
    {
        var f = Planned(state);
        var h = BuildHarness(f);

        await OrderDeliveryAddressWriter.PropagateToStopAsync(h.Db.Object, f.Order, Now, CancellationToken.None);

        h.Added.Should().BeEmpty();
        f.Stop.AddressChangedAt.Should().BeNull();
    }

    /// <summary>
    /// Two redirections are one change of address, and the value kept is the original
    /// destination — not the one it was pointed at in between.
    /// </summary>
    [Fact]
    public async Task Propagate_SecondTime_KeepsOneEntryWithTheOriginalAddress()
    {
        var f = Planned(OutgoingShipmentState.InTransit);
        var stored = StoredAddressEntry("Dlouhá 1, 46001 Liberec", "Nádražní 9, 46003 Liberec");
        var h = BuildHarness(f, stored);

        // The stop currently sits on the intermediate address; the order now says contact.
        f.Stop.SelectedAddressKind = DeliveryAddressKind.Official;

        await OrderDeliveryAddressWriter.PropagateToStopAsync(h.Db.Object, f.Order, Now, CancellationToken.None);

        h.Added.Should().BeEmpty();
        stored.PlannedText.Should().Be("Dlouhá 1, 46001 Liberec");
        stored.ActualText.Should().Be("Krátká 2, 46002 Liberec");
    }

    [Fact]
    public async Task Propagate_BackToTheOriginalAddress_DeletesTheEntry()
    {
        var f = Planned(OutgoingShipmentState.InTransit);
        f.Order.DeliveryAddressKind = DeliveryAddressKind.Official;
        f.Stop.SelectedAddressKind = DeliveryAddressKind.Contact;

        var stored = StoredAddressEntry("Dlouhá 1, 46001 Liberec", "Krátká 2, 46002 Liberec");
        var h = BuildHarness(f, stored);

        await OrderDeliveryAddressWriter.PropagateToStopAsync(h.Db.Object, f.Order, Now, CancellationToken.None);

        h.Removed.Should().ContainSingle().Which.Should().BeSameAs(stored);
        h.Added.Should().BeEmpty();
    }

    // ---------------------------------------------------------------------------------
    // Path 2: the planner moves the stop on the run itself. The commoner path, and the one
    // that stamped nothing at all before this.
    // ---------------------------------------------------------------------------------

    private static UpdateOutgoingShipmentRequest MoveStopRequest(
        Fixture f,
        DeliveryAddressKind kind,
        OutgoingShipmentState state) => new()
    {
        Id = f.Shipment.PublicId,
        Data = new UpdateOutgoingShipmentDto
        {
            Name = f.Shipment.Name,
            DeliveryDate = f.Shipment.DeliveryDate,
            VehicleId = f.Vehicle.PublicId,
            DriverIds = [f.Driver.PublicId],
            State = state,
            ClientOrderShipments =
            [
                new ClientOrderShipmentDto
                {
                    ClientOrderId = f.Order.PublicId,
                    Order = f.Stop.Order,
                    SelectedAddressKind = kind
                }
            ]
        }
    };

    private static Task MoveStopAsync(Harness h, UpdateOutgoingShipmentRequest request)
    {
        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(
            h.Db.Object,
            Options.Create(new CompanyOptions()),
            DriverScopeMockFactory.Unscoped(),
            AppContextMockFactory.Anonymous());

        return endpoint.HandleAsync(request, CancellationToken.None);
    }

    [Fact]
    public async Task MoveStop_OnARunningShipment_RecordsTheMove()
    {
        var f = Planned(OutgoingShipmentState.InTransit);
        var h = BuildHarness(f);

        await MoveStopAsync(h, MoveStopRequest(f, DeliveryAddressKind.Contact, OutgoingShipmentState.InTransit));

        var entry = h.Added.Should().ContainSingle().Subject;
        entry.Target.Should().Be(ClientLedgerEntryTarget.DeliveryAddress);
        entry.PlannedText.Should().Be("Dlouhá 1, 46001 Liberec");
        entry.ActualText.Should().Be("Krátká 2, 46002 Liberec");
        entry.RequiresFollowUp.Should().BeFalse();
        f.Stop.SelectedAddressKind.Should().Be(DeliveryAddressKind.Contact);
    }

    [Fact]
    public async Task MoveStop_WhileTheRunIsStillCreated_RecordsNothing()
    {
        var f = Planned(OutgoingShipmentState.Created);
        var h = BuildHarness(f);

        await MoveStopAsync(h, MoveStopRequest(f, DeliveryAddressKind.Contact, OutgoingShipmentState.Created));

        h.Added.Should().BeEmpty("moving a stop before the van leaves is planning, not a deviation");
        f.Stop.SelectedAddressKind.Should().Be(DeliveryAddressKind.Contact, "the move itself still happens");
    }

    /// <summary>
    /// Judged on the stored state, not the requested one: a save that both moves a stop and
    /// loads the run is still planning — the address it settles on is what gets loaded.
    /// </summary>
    [Fact]
    public async Task MoveStop_InTheSameSaveThatLoadsTheRun_RecordsNothing()
    {
        var f = Planned(OutgoingShipmentState.Created);
        var h = BuildHarness(f);

        await MoveStopAsync(h, MoveStopRequest(f, DeliveryAddressKind.Contact, OutgoingShipmentState.Loaded));

        h.Added.Should().BeEmpty();
    }

    [Fact]
    public async Task MoveStop_BackToWhereItStarted_DeletesTheEntry()
    {
        var f = Planned(OutgoingShipmentState.InTransit);
        f.Stop.SelectedAddressKind = DeliveryAddressKind.Contact;

        var stored = StoredAddressEntry("Dlouhá 1, 46001 Liberec", "Krátká 2, 46002 Liberec");
        var h = BuildHarness(f, stored);

        await MoveStopAsync(h, MoveStopRequest(f, DeliveryAddressKind.Official, OutgoingShipmentState.InTransit));

        h.Removed.Should().ContainSingle().Which.Should().BeSameAs(stored);
        h.Added.Should().BeEmpty();
    }

    [Fact]
    public async Task MoveStop_ASecondTime_KeepsOneEntryWithTheOriginalAddress()
    {
        var f = Planned(OutgoingShipmentState.InTransit);
        f.Stop.SelectedAddressKind = DeliveryAddressKind.Contact;

        var stored = StoredAddressEntry("Dlouhá 1, 46001 Liberec", "Krátká 2, 46002 Liberec");
        var h = BuildHarness(f, stored);

        // A third destination: the place, which is neither of the two addresses above.
        var place = ClientDeliveryPlaceBuilder.BuildEntity(publicId: Guid.NewGuid(), client: f.Client);
        place.Id = 91;
        place.Name = "Sklad";
        place.Address = AddressBuilder.BuildEntity(streetName: "Nádražní", streetNumber: "9", city: "Liberec", zip: "46003");

        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            orders: [f.Order],
            outgoingShipments: [f.Shipment],
            vehicles: [f.Vehicle],
            drivers: [f.Driver],
            clientDeliveryPlaces: [place],
            clientLedgerEntries: [stored]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var added = new List<ClientLedgerEntry>();
        db.Setup(x => x.ClientLedgerEntries.Add(It.IsAny<ClientLedgerEntry>())).Callback<ClientLedgerEntry>(added.Add);

        var request = MoveStopRequest(f, DeliveryAddressKind.DeliveryPlace, OutgoingShipmentState.InTransit);
        request.Data.ClientOrderShipments[0].ClientDeliveryPlaceId = place.PublicId;

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(
            db.Object,
            Options.Create(new CompanyOptions()),
            DriverScopeMockFactory.Unscoped(),
            AppContextMockFactory.Anonymous());

        await endpoint.HandleAsync(request, CancellationToken.None);

        added.Should().BeEmpty("two redirections are one change of address");
        stored.PlannedText.Should().Be("Dlouhá 1, 46001 Liberec", "the original destination is the interesting one");
        stored.ActualText.Should().Be("Sklad, Nádražní 9, 46003 Liberec");
    }
}
