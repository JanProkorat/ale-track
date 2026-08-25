using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Update;
using AleTrack.Features.Orders.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;
using Client = AleTrack.Entities.Client;

namespace AleTrack.Tests.Features.Orders;

/// <summary>
/// What an order edit invalidates: the invoice row somebody marked finished, and the loading tick
/// somebody counted into the van.
/// </summary>
/// <remarks>
/// Both marks mean "I checked this". Now that an order stays editable while its run is loaded and
/// on the road, an edit can move what was checked — and a mark left standing over a changed number
/// is worse than no mark at all, because the office reads it as done.
///
/// Deliberately narrow. A note, a reminder flag, a delivered date and a returns line are not on an
/// invoice and were never counted into the van, so a save that touches only those leaves both
/// marks alone; sending them back for checking would teach everyone to ignore the marks.
/// </remarks>
public sealed class OrderEditInvalidationTests
{
    private const long PayerRowId = 90;
    private const long ClientRowId = 91;
    private const long OtherClientRowId = 92;

    private sealed record Fixture(
        OutgoingShipment Shipment,
        Order Order,
        Client Client,
        Client Other,
        Product Product,
        OrderItem Item,
        OrderCustomExtraItem Extra);

    /// <summary>
    /// One run carrying one order, with the order's row marked finished and its line ticked off at
    /// the ramp — the state the office leaves behind when it has checked everything.
    /// </summary>
    private static Fixture Build(
        OutgoingShipmentState state = OutgoingShipmentState.Loaded,
        long? payerId = null,
        DateTime? filedAt = null)
    {
        var payer = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Head Office", officialAddress: AddressBuilder.BuildEntity());
        payer.Id = PayerRowId;

        var client = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Hospoda U Lva", officialAddress: AddressBuilder.BuildEntity());
        client.Id = ClientRowId;
        client.InvoicingClientId = payerId;
        client.InvoicingClient = payerId is null ? null : payer;

        var other = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Beseda", officialAddress: AddressBuilder.BuildEntity());
        other.Id = OtherClientRowId;

        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Ležák 12");
        product.Id = 41;

        var item = new OrderItem
        {
            Id = 51,
            PublicId = Guid.NewGuid(),
            Product = product,
            ProductId = product.Id,
            Quantity = 10,
            IsShipmentLoadingConfirmed = true
        };

        var extra = new OrderCustomExtraItem
        {
            Id = 61,
            PublicId = Guid.NewGuid(),
            Description = "Kelímky 0,5 l",
            Quantity = 50,
            IsShipmentLoadingConfirmed = true
        };

        var order = OrderBuilder.BuildEntity(
            publicId: Guid.NewGuid(), client: client, state: OrderState.Planning, orderItems: [item]);
        order.ClientId = client.Id;
        order.CustomExtraItems.Add(extra);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            state: state,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        shipment.InvoicingFiledAt = filedAt;

        // Every row of the split marked finished: the order's own payer, and an unrelated client's
        // row that must be left alone.
        foreach (var clientId in new[] { payerId ?? ClientRowId, OtherClientRowId })
        {
            shipment.InvoiceConfirmations.Add(new OutgoingShipmentInvoiceConfirmation
            {
                PublicId = Guid.NewGuid(),
                OutgoingShipment = shipment,
                ClientId = clientId,
                Number = clientId == OtherClientRowId ? 2 : 1,
                IsReady = true
            });
        }

        // The mocked context does no navigation fixup, and the freeze rule reaches the run through
        // the stop.
        var stop = shipment.Stops.First();
        stop.OutgoingShipment = shipment;
        order.OutgoingShipmentStop = stop;

        return new Fixture(shipment, order, client, other, product, item, extra);
    }

    private static Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> BuildDb(Fixture f)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client, f.Other],
            products: [f.Product],
            orders: [f.Order],
            outgoingShipments: [f.Shipment]);

        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return db;
    }

    /// <summary>The order's current content, as the editor re-sends it on every save.</summary>
    private static UpdateOrderDto Echo(Fixture f)
    {
        var data = OrderBuilder.BuildUpdateDto(
            clientId: f.Client.PublicId,
            state: null,
            actualDeliveryDate: null,
            orderItems: [new UpdateOrderItemDto { ProductId = f.Product.PublicId, Quantity = f.Item.Quantity }]);

        data.CustomExtraItems =
        [
            new OrderCustomExtraItemDto
            {
                Id = f.Extra.PublicId, Description = f.Extra.Description, Quantity = f.Extra.Quantity
            }
        ];

        return data;
    }

    private static Task SaveAsync(Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> db, Fixture f, UpdateOrderDto data)
    {
        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(
            db.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());

        return endpoint.HandleAsync(new UpdateOrderRequest { Id = f.Order.PublicId, Data = data }, CancellationToken.None);
    }

    private static bool MarkOf(Fixture f, long clientId) =>
        f.Shipment.InvoiceConfirmations.Single(c => c.ClientId == clientId).IsReady;

    // ---------------------------------------------------------------------------------
    // The invoice mark.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task ChangedQuantity_SendsTheInvoiceRowBackForChecking()
    {
        var f = Build();
        var db = BuildDb(f);

        var data = Echo(f);
        data.OrderItems[0].Quantity = 12;

        await SaveAsync(db, f, data);

        MarkOf(f, ClientRowId).Should().BeFalse();
        MarkOf(f, OtherClientRowId).Should().BeTrue("another client's row was not checked against this order");
    }

    /// <summary>
    /// The number survives, exactly as un-marking by hand keeps it: re-marking gives the same one
    /// back, and no number is ever printed against two clients.
    /// </summary>
    [Fact]
    public async Task Unmarking_KeepsTheRowsNumber()
    {
        var f = Build();
        var db = BuildDb(f);

        var data = Echo(f);
        data.OrderItems.Clear();

        await SaveAsync(db, f, data);

        var row = f.Shipment.InvoiceConfirmations.Single(c => c.ClientId == ClientRowId);
        row.IsReady.Should().BeFalse();
        row.Number.Should().Be(1);
    }

    [Fact]
    public async Task ChangedExtraQuantity_SendsTheInvoiceRowBackToo()
    {
        var f = Build();
        var db = BuildDb(f);

        var data = Echo(f);
        data.CustomExtraItems[0].Quantity = 80;

        await SaveAsync(db, f, data);

        MarkOf(f, ClientRowId).Should().BeFalse();
    }

    /// <summary>
    /// A sub-client's order is billed on its payer's row, so that is the row to un-mark — the
    /// ordering client has none of its own.
    /// </summary>
    [Fact]
    public async Task ASubClientsOrder_UnmarksThePayersRow()
    {
        var f = Build(payerId: PayerRowId);
        var db = BuildDb(f);

        var data = Echo(f);
        data.OrderItems[0].Quantity = 12;

        await SaveAsync(db, f, data);

        MarkOf(f, PayerRowId).Should().BeFalse();
    }

    /// <summary>
    /// Moving the order to a different client leaves the old row holding a check of goods that are
    /// no longer on it.
    /// </summary>
    [Fact]
    public async Task ChangedClient_UnmarksBothRows()
    {
        var f = Build();
        var db = BuildDb(f);

        var data = Echo(f);
        data.ClientId = f.Other.PublicId;

        await SaveAsync(db, f, data);

        MarkOf(f, ClientRowId).Should().BeFalse("what it was checked against has left it");
        MarkOf(f, OtherClientRowId).Should().BeFalse("it now carries goods nobody checked there");
    }

    /// <summary>
    /// Nothing billed moved, so nothing goes back for checking. Marks that reset over a note are
    /// marks the office learns to ignore.
    /// </summary>
    [Fact]
    public async Task NotesAndReturnsOnly_LeaveTheMarksAlone()
    {
        var f = Build();
        var db = BuildDb(f);

        var data = Echo(f);
        data.Notes = [new OrderNoteDto { Text = "Volal, bude tam po druhé." }];
        data.Returns = [new OrderReturnDto { Name = "Sudy 50 l", Quantity = 4 }];

        await SaveAsync(db, f, data);

        MarkOf(f, ClientRowId).Should().BeTrue();
    }

    [Fact]
    public async Task ReminderFlagOnly_LeavesTheMarkAlone()
    {
        var f = Build();
        var db = BuildDb(f);

        var data = Echo(f);
        data.OrderItems[0].ReminderState = OrderItemReminderState.Added;

        await SaveAsync(db, f, data);

        MarkOf(f, ClientRowId).Should().BeTrue();
    }

    /// <summary>
    /// A filed run's marks are the record of what was filed. Its content cannot be edited at all,
    /// but a notes-only save still goes through — and must not touch them.
    /// </summary>
    [Fact]
    public async Task NotesOnlySaveOnAFiledRun_LeavesTheMarksAlone()
    {
        var f = Build(filedAt: new DateTime(2026, 8, 25, 9, 0, 0, DateTimeKind.Utc));
        var db = BuildDb(f);

        var data = Echo(f);
        data.Notes = [new OrderNoteDto { Text = "Reklamace vyřízena." }];

        await SaveAsync(db, f, data);

        MarkOf(f, ClientRowId).Should().BeTrue();
    }

    // ---------------------------------------------------------------------------------
    // The loading tick, which lives on the line itself.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task ChangedQuantity_ClearsTheLinesLoadingTick()
    {
        var f = Build();
        var db = BuildDb(f);

        var data = Echo(f);
        data.OrderItems[0].Quantity = 12;

        await SaveAsync(db, f, data);

        f.Order.OrderItems.Single().IsShipmentLoadingConfirmed.Should().BeFalse();
    }

    [Fact]
    public async Task ChangedExtraQuantity_ClearsTheExtrasLoadingTick()
    {
        var f = Build();
        var db = BuildDb(f);

        var data = Echo(f);
        data.CustomExtraItems[0].Quantity = 80;

        await SaveAsync(db, f, data);

        f.Order.CustomExtraItems.Single().IsShipmentLoadingConfirmed.Should().BeFalse();
    }

    /// <summary>
    /// The tick says somebody counted these pieces into the van. Renaming a line or noting
    /// something about it does not un-count them.
    /// </summary>
    [Fact]
    public async Task SameQuantity_KeepsTheLoadingTicks()
    {
        var f = Build();
        var db = BuildDb(f);

        var data = Echo(f);
        data.CustomExtraItems[0].Description = "Kelímky 0,5 l — bílé";
        data.Notes = [new OrderNoteDto { Text = "Bez poznámky." }];

        await SaveAsync(db, f, data);

        f.Order.OrderItems.Single().IsShipmentLoadingConfirmed.Should().BeTrue();
        f.Order.CustomExtraItems.Single().IsShipmentLoadingConfirmed.Should().BeTrue();
    }
}
