using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Clients.Commands.Ledger.Delete;
using AleTrack.Features.Clients.Commands.Ledger.Resolution;
using AleTrack.Features.Clients.Commands.Ledger.Save;
using AleTrack.Features.Clients.Commands.Ledger.Update;
using AleTrack.Features.Clients.Queries.Ledger;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;
using Client = AleTrack.Entities.Client;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// The client ledger's write path. The failure every one of these guards against is double
/// counting: a form reopened and saved again must correct the stored deviation, not add a
/// second one.
/// </summary>
public sealed class ClientLedgerTests
{
    private const long ClientRowId = 11;
    private const long OrderRowId = 21;
    private const long ProductRowId = 41;
    private const long ItemRowId = 51;
    private const long ReturnRowId = 61;

    private sealed record Fixture(
        Client Client,
        Order Order,
        Product Product,
        OrderItem Item,
        OrderReturn Return);

    private static Fixture BuildFixture(
        OrderState orderState = OrderState.Planning,
        OutgoingShipmentState? shipmentState = null)
    {
        var client = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());
        client.Id = ClientRowId;

        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Ležák 12");
        product.Id = ProductRowId;

        var item = new OrderItem
        {
            Id = ItemRowId,
            PublicId = Guid.NewGuid(),
            Product = product,
            ProductId = product.Id,
            Quantity = 10
        };

        var orderReturn = new OrderReturn
        {
            Id = ReturnRowId,
            PublicId = Guid.NewGuid(),
            Name = "Sudy 50 l",
            Quantity = 4
        };

        var order = OrderBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            client: client,
            state: orderState,
            orderItems: [item],
            returns: [orderReturn]);
        order.Id = OrderRowId;
        order.ClientId = client.Id;

        if (shipmentState is not null)
        {
            order.OutgoingShipmentStop = new OutgoingShipmentStop
            {
                Id = 71,
                PublicId = Guid.NewGuid(),
                Kind = OutgoingShipmentStopKind.Order,
                Order = 1,
                OutgoingShipment = OutgoingShipmentBuilder.BuildEntity(state: shipmentState.Value)
            };
        }

        return new Fixture(client, order, product, item, orderReturn);
    }

    /// <summary>
    /// The mocked context plus the two lists a ledger write is observed through: what it added
    /// and what it removed.
    /// </summary>
    private sealed record Harness(
        Mock<AleTrackDbContext> Db,
        List<ClientLedgerEntry> Added,
        List<ClientLedgerEntry> Removed);

    private static Harness BuildHarness(Fixture f, params ClientLedgerEntry[] stored)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            products: [f.Product],
            orders: [f.Order],
            clientLedgerEntries: [.. stored]);

        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var added = new List<ClientLedgerEntry>();
        var removed = new List<ClientLedgerEntry>();
        db.Setup(x => x.ClientLedgerEntries.Add(It.IsAny<ClientLedgerEntry>()))
            .Callback<ClientLedgerEntry>(added.Add);
        db.Setup(x => x.ClientLedgerEntries.Remove(It.IsAny<ClientLedgerEntry>()))
            .Callback<ClientLedgerEntry>(removed.Add);

        return new Harness(db, added, removed);
    }

    /// <summary>A stored, unresolved deviation on the fixture's beer line.</summary>
    private static ClientLedgerEntry StoredProductEntry(Fixture f, int planned, int actual) => new()
    {
        Id = 101,
        PublicId = Guid.NewGuid(),
        ClientId = ClientRowId,
        OrderId = OrderRowId,
        Target = ClientLedgerEntryTarget.ProductQuantity,
        OrderItemId = ItemRowId,
        ProductId = ProductRowId,
        ProductName = "Ležák 12",
        PlannedQuantity = planned,
        ActualQuantity = actual,
        RequiresFollowUp = actual < planned,
        CreatedAt = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Utc)
    };

    private static Task SaveAsync(Harness h, Fixture f, params ClientLedgerRowDto[] rows)
    {
        var endpoint = EndpointBuilder<SaveClientLedgerEntriesRequest, SaveClientLedgerEntriesEndpoint>
            .Create(h.Db.Object, AppContextMock().Object);

        return endpoint.HandleAsync(
            new SaveClientLedgerEntriesRequest
            {
                Id = f.Client.PublicId,
                Data = new SaveClientLedgerEntriesDto { OrderId = f.Order.PublicId, Rows = [.. rows] }
            },
            CancellationToken.None);
    }

    private static Mock<IAppContext> AppContextMock()
    {
        var appContext = new Mock<IAppContext>();
        appContext.SetupGet(a => a.UserId).Returns((Guid?)null);
        return appContext;
    }

    private static ClientLedgerRowDto ProductRow(Fixture f, int planned, int actual, string? note = null) => new()
    {
        Target = ClientLedgerEntryTarget.ProductQuantity,
        OrderItemId = f.Item.PublicId,
        PlannedQuantity = planned,
        ActualQuantity = actual,
        Note = note
    };

    // ---------------------------------------------------------------------------------
    // The upsert invariant.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task Save_FirstDeviationOnALine_InsertsIt()
    {
        var f = BuildFixture();
        var h = BuildHarness(f);

        await SaveAsync(h, f, ProductRow(f, planned: 10, actual: 7, note: "řidič nechal paletu"));

        var entry = h.Added.Should().ContainSingle().Subject;
        entry.ClientId.Should().Be(ClientRowId);
        entry.OrderId.Should().Be(OrderRowId);
        entry.OrderItemId.Should().Be(ItemRowId);
        entry.ProductId.Should().Be(ProductRowId);
        entry.ProductName.Should().Be("Ležák 12", "the snapshot outlives the product");
        entry.PlannedQuantity.Should().Be(10);
        entry.ActualQuantity.Should().Be(7);
        entry.RequiresFollowUp.Should().BeTrue("three pieces are owed");
        entry.Note.Should().Be("řidič nechal paletu");
        h.Removed.Should().BeEmpty();
    }

    /// <summary>
    /// The trap the whole feature rests on: a second save of the same line must correct the
    /// stored deviation. Appending would leave the client owing six kegs instead of three.
    /// </summary>
    [Fact]
    public async Task Save_SecondDeviationOnTheSameLine_OverwritesInsteadOfAppending()
    {
        var f = BuildFixture();
        var stored = StoredProductEntry(f, planned: 10, actual: 7);
        var h = BuildHarness(f, stored);

        await SaveAsync(h, f, ProductRow(f, planned: 10, actual: 4));

        h.Added.Should().BeEmpty("the stored entry is corrected, not duplicated");
        h.Removed.Should().BeEmpty();
        stored.ActualQuantity.Should().Be(4);
        stored.RequiresFollowUp.Should().BeTrue();
        h.Db.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Save_ActualBackAtThePlan_DeletesTheEntry()
    {
        var f = BuildFixture();
        var stored = StoredProductEntry(f, planned: 10, actual: 7);
        var h = BuildHarness(f, stored);

        await SaveAsync(h, f, ProductRow(f, planned: 10, actual: 10));

        h.Removed.Should().ContainSingle().Which.Should().BeSameAs(stored);
        h.Added.Should().BeEmpty("the ledger holds no no-op rows");
    }

    [Fact]
    public async Task Save_NoDeviationAndNothingStored_WritesNothing()
    {
        var f = BuildFixture();
        var h = BuildHarness(f);

        await SaveAsync(h, f, ProductRow(f, planned: 10, actual: 10));

        h.Added.Should().BeEmpty();
        h.Removed.Should().BeEmpty();
    }

    /// <summary>
    /// A settled entry is history. The next deviation on the same line gets a row beside it —
    /// which is exactly what the partial unique index, filtered on unresolved rows, permits.
    /// </summary>
    [Fact]
    public async Task Save_LineWithASettledEntry_InsertsANewRowBesideIt()
    {
        var f = BuildFixture();
        var settled = StoredProductEntry(f, planned: 10, actual: 7);
        settled.ResolvedAt = new DateTime(2026, 8, 20, 8, 0, 0, DateTimeKind.Utc);
        var h = BuildHarness(f, settled);

        await SaveAsync(h, f, ProductRow(f, planned: 10, actual: 4));

        h.Added.Should().ContainSingle().Which.ActualQuantity.Should().Be(4);
        settled.ActualQuantity.Should().Be(7, "history is not rewritten");
        h.Removed.Should().BeEmpty();
    }

    // ---------------------------------------------------------------------------------
    // requires_follow_up is derived, not asserted by the caller.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task Save_MoreProductsThanPlanned_NeedsNoFollowUp()
    {
        var f = BuildFixture();
        var h = BuildHarness(f);

        await SaveAsync(h, f, ProductRow(f, planned: 10, actual: 12));

        h.Added.Should().ContainSingle().Which.RequiresFollowUp
            .Should().BeFalse("the extra pieces are with the client and get billed");
    }

    [Fact]
    public async Task Save_MoreEmptiesThanPlanned_StillNeedsFollowUp()
    {
        var f = BuildFixture();
        var h = BuildHarness(f);

        await SaveAsync(h, f, new ClientLedgerRowDto
        {
            Target = ClientLedgerEntryTarget.ReturnQuantity,
            OrderReturnId = f.Return.PublicId,
            PlannedQuantity = 4,
            ActualQuantity = 6
        });

        h.Added.Should().ContainSingle().Which.RequiresFollowUp
            .Should().BeTrue("a return has no good direction — we hold deposits that are not ours");
    }

    [Fact]
    public async Task Save_AddressChange_IsARecordAndNeverADebt()
    {
        var f = BuildFixture();
        var h = BuildHarness(f);

        await SaveAsync(h, f, new ClientLedgerRowDto
        {
            Target = ClientLedgerEntryTarget.DeliveryAddress,
            PlannedText = "Dlouhá 1, Liberec",
            ActualText = "Krátká 2, Liberec"
        });

        var entry = h.Added.Should().ContainSingle().Subject;
        entry.RequiresFollowUp.Should().BeFalse();
        entry.PlannedText.Should().Be("Dlouhá 1, Liberec");
        entry.ActualText.Should().Be("Krátká 2, Liberec");
    }

    /// <summary>
    /// Two redirections are one change of address, and the value worth keeping is where it was
    /// originally meant to go — not where it was pointed in between.
    /// </summary>
    [Fact]
    public async Task Save_SecondRedirectionOfTheSameStop_KeepsTheOriginalPlannedAddress()
    {
        var f = BuildFixture();
        var stored = new ClientLedgerEntry
        {
            Id = 102,
            PublicId = Guid.NewGuid(),
            ClientId = ClientRowId,
            OrderId = OrderRowId,
            Target = ClientLedgerEntryTarget.DeliveryAddress,
            PlannedText = "Dlouhá 1, Liberec",
            ActualText = "Krátká 2, Liberec",
            CreatedAt = new DateTime(2026, 8, 24, 9, 0, 0, DateTimeKind.Utc)
        };
        var h = BuildHarness(f, stored);

        await SaveAsync(h, f, new ClientLedgerRowDto
        {
            Target = ClientLedgerEntryTarget.DeliveryAddress,
            PlannedText = "Krátká 2, Liberec",
            ActualText = "Nádražní 9, Liberec"
        });

        h.Added.Should().BeEmpty();
        stored.PlannedText.Should().Be("Dlouhá 1, Liberec");
        stored.ActualText.Should().Be("Nádražní 9, Liberec");
    }

    [Fact]
    public async Task Save_StopRedirectedBackToWhereItStarted_DeletesTheEntry()
    {
        var f = BuildFixture();
        var stored = new ClientLedgerEntry
        {
            Id = 103,
            PublicId = Guid.NewGuid(),
            ClientId = ClientRowId,
            OrderId = OrderRowId,
            Target = ClientLedgerEntryTarget.DeliveryAddress,
            PlannedText = "Dlouhá 1, Liberec",
            ActualText = "Krátká 2, Liberec",
            CreatedAt = new DateTime(2026, 8, 24, 9, 0, 0, DateTimeKind.Utc)
        };
        var h = BuildHarness(f, stored);

        await SaveAsync(h, f, new ClientLedgerRowDto
        {
            Target = ClientLedgerEntryTarget.DeliveryAddress,
            PlannedText = "Krátká 2, Liberec",
            ActualText = "Dlouhá 1, Liberec"
        });

        h.Removed.Should().ContainSingle().Which.Should().BeSameAs(stored);
    }

    /// <summary>
    /// Money rows are appended, not paired: "you owe me 500" and "I owe you 300" are two things
    /// to settle, so a second one must not overwrite the first.
    /// </summary>
    [Fact]
    public async Task Save_SecondMoneyRow_IsAppendedNotMerged()
    {
        var f = BuildFixture();
        var stored = new ClientLedgerEntry
        {
            Id = 104,
            PublicId = Guid.NewGuid(),
            ClientId = ClientRowId,
            OrderId = OrderRowId,
            Target = ClientLedgerEntryTarget.Money,
            Amount = 500m,
            RequiresFollowUp = true,
            CreatedAt = new DateTime(2026, 8, 24, 9, 0, 0, DateTimeKind.Utc)
        };
        var h = BuildHarness(f, stored);

        await SaveAsync(h, f, new ClientLedgerRowDto
        {
            Target = ClientLedgerEntryTarget.Money,
            Amount = -300m,
            Note = "vratka za rozbitou basu"
        });

        h.Added.Should().ContainSingle().Which.Amount.Should().Be(-300m);
        stored.Amount.Should().Be(500m);
    }

    /// <summary>
    /// A product taken at the door has no order line to diff against, so the product alone
    /// identifies it and the planned quantity is zero.
    /// </summary>
    [Fact]
    public async Task Save_ProductTakenAtTheDoor_IsRecordedWithoutAnOrderLine()
    {
        var f = BuildFixture();
        var h = BuildHarness(f);

        await SaveAsync(h, f, new ClientLedgerRowDto
        {
            Target = ClientLedgerEntryTarget.ProductQuantity,
            ProductId = f.Product.PublicId,
            PlannedQuantity = 0,
            ActualQuantity = 4
        });

        var entry = h.Added.Should().ContainSingle().Subject;
        entry.OrderItemId.Should().BeNull();
        entry.ProductId.Should().Be(ProductRowId);
        entry.ProductName.Should().Be("Ležák 12");
        entry.PlannedQuantity.Should().Be(0);
        entry.RequiresFollowUp.Should().BeFalse("they are with the client and get billed");
    }

    /// <summary>
    /// A good handed over at the door, the mirror of the product above: the good identifies it,
    /// because there is no order line and a free-text name would lose the supplier's price list.
    /// </summary>
    [Fact]
    public async Task Save_SupplierGoodTakenAtTheDoor_IsRecordedAgainstTheGood()
    {
        var f = BuildFixture();
        var good = SupplierBuilder.BuildGood(id: 91, name: "CO₂ láhev");

        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            products: [f.Product],
            orders: [f.Order],
            supplierGoods: [good]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var added = new List<ClientLedgerEntry>();
        db.Setup(x => x.ClientLedgerEntries.Add(It.IsAny<ClientLedgerEntry>()))
            .Callback<ClientLedgerEntry>(added.Add);

        var h = new Harness(db, added, []);

        await SaveAsync(h, f, new ClientLedgerRowDto
        {
            Target = ClientLedgerEntryTarget.SupplierGoodQuantity,
            SupplierGoodId = good.PublicId,
            PlannedQuantity = 0,
            ActualQuantity = 2
        });

        var entry = added.Should().ContainSingle().Subject;
        entry.SupplierGoodItemId.Should().BeNull("nothing on the order planned it");
        entry.SupplierGoodId.Should().Be(91);
        entry.GoodName.Should().Be("CO₂ láhev");
        entry.PlannedQuantity.Should().Be(0);
        entry.ActualQuantity.Should().Be(2);
    }

    [Fact]
    public async Task Save_UnknownSupplierGood_NotFound()
    {
        var f = BuildFixture();
        var h = BuildHarness(f);

        var act = () => SaveAsync(h, f, new ClientLedgerRowDto
        {
            Target = ClientLedgerEntryTarget.SupplierGoodQuantity,
            SupplierGoodId = Guid.NewGuid(),
            PlannedQuantity = 0,
            ActualQuantity = 2
        });

        await act.Should().ThrowAsync<Exception>();
    }

    /// <summary>
    /// The ledger is a record beside the order, so recording against a delivered one is normal —
    /// that is when deviations are known. Nothing here may touch the frozen-content guarantee.
    /// </summary>
    [Fact]
    public async Task Save_OnADeliveredOrder_Succeeds()
    {
        var f = BuildFixture(OrderState.Finished, OutgoingShipmentState.Delivered);
        var h = BuildHarness(f);

        await SaveAsync(h, f, ProductRow(f, planned: 10, actual: 7));

        h.Added.Should().ContainSingle();
        f.Order.OrderItems.Should().ContainSingle().Which.Quantity
            .Should().Be(10, "the order is the plan and the ledger does not edit it");
    }

    /// <summary>
    /// The stop is derived from the order rather than posted: an order sits on at most one stop,
    /// so a posted one could only agree or be wrong.
    /// </summary>
    [Fact]
    public async Task Save_OnAnOrderWithAStop_RecordsWhichStopItHappenedAt()
    {
        var f = BuildFixture(OrderState.Delivering, OutgoingShipmentState.InTransit);
        var h = BuildHarness(f);

        await SaveAsync(h, f, ProductRow(f, planned: 10, actual: 7));

        h.Added.Should().ContainSingle().Which.StopId.Should().Be(71);
    }

    [Fact]
    public async Task Save_UnknownClient_NotFound()
    {
        var f = BuildFixture();
        var h = BuildHarness(f);

        var endpoint = EndpointBuilder<SaveClientLedgerEntriesRequest, SaveClientLedgerEntriesEndpoint>
            .Create(h.Db.Object, AppContextMock().Object);

        var act = async () => await endpoint.HandleAsync(
            new SaveClientLedgerEntriesRequest
            {
                Id = Guid.NewGuid(),
                Data = new SaveClientLedgerEntriesDto { Rows = [] }
            },
            CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    /// <summary>
    /// A posted line is resolved against the order's own collections, so a row cannot claim to
    /// be about a line of some other delivery.
    /// </summary>
    [Fact]
    public async Task Save_LineFromAnotherOrder_NotFound()
    {
        var f = BuildFixture();
        var h = BuildHarness(f);

        var act = async () => await SaveAsync(h, f, new ClientLedgerRowDto
        {
            Target = ClientLedgerEntryTarget.ProductQuantity,
            OrderItemId = Guid.NewGuid(),
            PlannedQuantity = 10,
            ActualQuantity = 7
        });

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    // ---------------------------------------------------------------------------------
    // Resolution is its own transition, and it reopens.
    // ---------------------------------------------------------------------------------

    private static Task SetResolutionAsync(
        Mock<AleTrackDbContext> db,
        ClientLedgerEntry entry,
        bool resolved,
        string? note = null)
    {
        var endpoint = EndpointBuilder<SetClientLedgerEntryResolutionRequest, SetClientLedgerEntryResolutionEndpoint>
            .Create(db.Object, AppContextMock().Object);

        return endpoint.HandleAsync(
            new SetClientLedgerEntryResolutionRequest
            {
                Id = entry.PublicId,
                Data = new SetClientLedgerEntryResolutionDto { Resolved = resolved, Note = note }
            },
            CancellationToken.None);
    }

    [Fact]
    public async Task SetResolution_Resolved_StampsItAndKeepsTheNote()
    {
        var f = BuildFixture();
        var entry = StoredProductEntry(f, planned: 10, actual: 7);
        var h = BuildHarness(f, entry);

        await SetResolutionAsync(h.Db, entry, resolved: true, note: "dovezeno 26. 8.");

        entry.ResolvedAt.Should().NotBeNull();
        entry.ResolutionNote.Should().Be("dovezeno 26. 8.");
    }

    /// <summary>
    /// Reopening clears the settling order too: it says that order did not settle this after
    /// all, and a stale link would show the row as carried by a delivered order — offering no
    /// manual close and never closing itself.
    /// </summary>
    [Fact]
    public async Task SetResolution_Reopened_ClearsTheSettlementAndItsOrder()
    {
        var f = BuildFixture();
        var entry = StoredProductEntry(f, planned: 10, actual: 7);
        entry.ResolvedAt = new DateTime(2026, 8, 24, 12, 0, 0, DateTimeKind.Utc);
        entry.ResolvedByOrderId = 99;
        entry.ResolutionNote = "dovezeno";
        var h = BuildHarness(f, entry);

        await SetResolutionAsync(h.Db, entry, resolved: false, note: "nebylo dovezeno");

        entry.ResolvedAt.Should().BeNull();
        entry.ResolvedByOrderId.Should().BeNull();
        entry.ResolvedByUserId.Should().BeNull();
        entry.ResolutionNote.Should().Be("nebylo dovezeno");
    }

    // ---------------------------------------------------------------------------------
    // Correcting and dropping one entry.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task Update_CorrectedQuantities_RecomputeWhetherAnythingIsOwed()
    {
        var f = BuildFixture();
        var entry = StoredProductEntry(f, planned: 10, actual: 7);
        var h = BuildHarness(f, entry);

        var endpoint = EndpointBuilder<UpdateClientLedgerEntryRequest, UpdateClientLedgerEntryEndpoint>
            .Create(h.Db.Object);

        await endpoint.HandleAsync(
            new UpdateClientLedgerEntryRequest
            {
                Id = entry.PublicId,
                Data = new UpdateClientLedgerEntryDto { PlannedQuantity = 10, ActualQuantity = 12 }
            },
            CancellationToken.None);

        entry.ActualQuantity.Should().Be(12);
        entry.RequiresFollowUp.Should().BeFalse("over-delivered beer is billed, not owed");
    }

    [Fact]
    public async Task Delete_RemovesTheEntry()
    {
        var f = BuildFixture();
        var entry = StoredProductEntry(f, planned: 10, actual: 7);
        var h = BuildHarness(f, entry);

        var endpoint = EndpointBuilder<DeleteClientLedgerEntryRequest, DeleteClientLedgerEntryEndpoint>
            .Create(h.Db.Object);

        await endpoint.HandleAsync(new DeleteClientLedgerEntryRequest { Id = entry.PublicId }, CancellationToken.None);

        h.Removed.Should().ContainSingle().Which.Should().BeSameAs(entry);
    }

    // ---------------------------------------------------------------------------------
    // Reading it back.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task Get_OpenState_LeavesSettledEntriesOut()
    {
        var f = BuildFixture();
        var open = StoredProductEntry(f, planned: 10, actual: 7);
        var settled = StoredProductEntry(f, planned: 10, actual: 4);
        settled.Id = 105;
        settled.PublicId = Guid.NewGuid();
        settled.ResolvedAt = new DateTime(2026, 8, 20, 8, 0, 0, DateTimeKind.Utc);

        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            clientLedgerEntries: [open, settled]);

        // The navigation is what the query filters on; the mock does no fixup.
        open.Client = f.Client;
        settled.Client = f.Client;

        var endpoint = EndpointWithResponseBuilder<GetClientLedgerEntriesRequest, List<ClientLedgerEntryDto>, GetClientLedgerEntriesEndpoint>
            .Create(db.Object);

        await endpoint.HandleAsync(
            new GetClientLedgerEntriesRequest { Id = f.Client.PublicId, State = ClientLedgerQueryState.Open },
            CancellationToken.None);

        endpoint.Response.Should().ContainSingle().Which.Id.Should().Be(open.PublicId);
    }

    [Fact]
    public async Task Get_AllState_ReturnsSettledEntriesToo()
    {
        var f = BuildFixture();
        var open = StoredProductEntry(f, planned: 10, actual: 7);
        var settled = StoredProductEntry(f, planned: 10, actual: 4);
        settled.Id = 105;
        settled.PublicId = Guid.NewGuid();
        settled.ResolvedAt = new DateTime(2026, 8, 20, 8, 0, 0, DateTimeKind.Utc);

        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            clientLedgerEntries: [open, settled]);

        open.Client = f.Client;
        settled.Client = f.Client;

        var endpoint = EndpointWithResponseBuilder<GetClientLedgerEntriesRequest, List<ClientLedgerEntryDto>, GetClientLedgerEntriesEndpoint>
            .Create(db.Object);

        await endpoint.HandleAsync(
            new GetClientLedgerEntriesRequest { Id = f.Client.PublicId, State = ClientLedgerQueryState.All },
            CancellationToken.None);

        endpoint.Response.Should().HaveCount(2);
    }

    /// <summary>
    /// Reported: a deviation on a vratka or an extra the order already had read as "Změna" — the
    /// operator could not tell which line it was about. Such a row stores only the line's id; the
    /// name is derived on read.
    /// </summary>
    [Fact]
    public async Task Get_DeviationOnAReturnLine_IsNamedAfterThatLine()
    {
        var f = BuildFixture();

        var entry = StoredProductEntry(f, planned: 5, actual: 4);
        entry.Target = ClientLedgerEntryTarget.ReturnQuantity;
        entry.OrderItemId = null;
        entry.ProductId = null;
        entry.ProductName = null;
        entry.OrderReturnId = ReturnRowId;
        entry.OrderReturn = f.Return;
        entry.Client = f.Client;

        var db = AleTrackDbContextMockFactory.CreateMock(clients: [f.Client], clientLedgerEntries: [entry]);

        var endpoint = EndpointWithResponseBuilder<GetClientLedgerEntriesRequest, List<ClientLedgerEntryDto>, GetClientLedgerEntriesEndpoint>
            .Create(db.Object);
        await endpoint.HandleAsync(new GetClientLedgerEntriesRequest { Id = f.Client.PublicId }, CancellationToken.None);

        endpoint.Response.Should().ContainSingle().Which.LineName.Should().Be("Sudy 50 l");
    }

    [Fact]
    public async Task Get_DeviationOnACustomExtraLine_IsNamedAfterThatLine()
    {
        var f = BuildFixture();
        var extra = new OrderCustomExtraItem
        {
            Id = 81, PublicId = Guid.NewGuid(), Description = "Tácky", Quantity = 7
        };

        var entry = StoredProductEntry(f, planned: 7, actual: 6);
        entry.Target = ClientLedgerEntryTarget.CustomExtraQuantity;
        entry.OrderItemId = null;
        entry.ProductId = null;
        entry.ProductName = null;
        entry.CustomExtraItemId = extra.Id;
        entry.CustomExtraItem = extra;
        entry.Client = f.Client;

        var db = AleTrackDbContextMockFactory.CreateMock(clients: [f.Client], clientLedgerEntries: [entry]);

        var endpoint = EndpointWithResponseBuilder<GetClientLedgerEntriesRequest, List<ClientLedgerEntryDto>, GetClientLedgerEntriesEndpoint>
            .Create(db.Object);
        await endpoint.HandleAsync(new GetClientLedgerEntriesRequest { Id = f.Client.PublicId }, CancellationToken.None);

        endpoint.Response.Should().ContainSingle().Which.LineName.Should().Be("Tácky");
    }

    [Fact]
    public async Task Get_DeviationOnASupplierGoodLine_IsNamedAfterThatGood()
    {
        var f = BuildFixture();
        var good = SupplierBuilder.BuildGood(id: 91, name: "Biogon");
        var goodItem = new OrderSupplierGoodItem
        {
            Id = 92, PublicId = Guid.NewGuid(), SupplierGood = good, SupplierGoodId = good.Id, Quantity = 2
        };

        var entry = StoredProductEntry(f, planned: 2, actual: 1);
        entry.Target = ClientLedgerEntryTarget.SupplierGoodQuantity;
        entry.OrderItemId = null;
        entry.ProductId = null;
        entry.ProductName = null;
        entry.SupplierGoodItemId = goodItem.Id;
        entry.SupplierGoodItem = goodItem;
        entry.Client = f.Client;

        var db = AleTrackDbContextMockFactory.CreateMock(clients: [f.Client], clientLedgerEntries: [entry]);

        var endpoint = EndpointWithResponseBuilder<GetClientLedgerEntriesRequest, List<ClientLedgerEntryDto>, GetClientLedgerEntriesEndpoint>
            .Create(db.Object);
        await endpoint.HandleAsync(new GetClientLedgerEntriesRequest { Id = f.Client.PublicId }, CancellationToken.None);

        endpoint.Response.Should().ContainSingle().Which.GoodName.Should().Be("Biogon");
    }

    /// <summary>
    /// The stored name still wins: something handed over with no line at all is named on the entry
    /// itself, and that name has to survive the line it never had.
    /// </summary>
    [Fact]
    public async Task Get_FreeTextLineName_IsKeptAsWritten()
    {
        var f = BuildFixture();

        var entry = StoredProductEntry(f, planned: 0, actual: 4);
        entry.Target = ClientLedgerEntryTarget.ReturnQuantity;
        entry.OrderItemId = null;
        entry.ProductId = null;
        entry.ProductName = null;
        entry.LineName = "Basy prázdných";
        entry.OrderReturnId = ReturnRowId;
        entry.OrderReturn = f.Return;
        entry.Client = f.Client;

        var db = AleTrackDbContextMockFactory.CreateMock(clients: [f.Client], clientLedgerEntries: [entry]);

        var endpoint = EndpointWithResponseBuilder<GetClientLedgerEntriesRequest, List<ClientLedgerEntryDto>, GetClientLedgerEntriesEndpoint>
            .Create(db.Object);
        await endpoint.HandleAsync(new GetClientLedgerEntriesRequest { Id = f.Client.PublicId }, CancellationToken.None);

        endpoint.Response.Should().ContainSingle().Which.LineName.Should().Be("Basy prázdných");
    }

    /// <summary>
    /// The client profile groups the ledger by order and dates each group from the run carrying
    /// it, so the read has to carry that date rather than only the order's promised one.
    /// </summary>
    [Fact]
    public async Task Get_OrderOnAShipment_CarriesThatRunsDeliveryDate()
    {
        var deliveryDate = new DateTime(2026, 8, 26, 6, 30, 0, DateTimeKind.Utc);
        var f = BuildFixture();
        f.Order.OutgoingShipmentStop = new OutgoingShipmentStop
        {
            Id = 71,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            OutgoingShipment = OutgoingShipmentBuilder.BuildEntity(deliveryDate: deliveryDate)
        };

        var entry = StoredProductEntry(f, planned: 10, actual: 7);
        entry.Client = f.Client;
        entry.Order = f.Order;

        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            clientLedgerEntries: [entry]);

        var endpoint = EndpointWithResponseBuilder<GetClientLedgerEntriesRequest, List<ClientLedgerEntryDto>, GetClientLedgerEntriesEndpoint>
            .Create(db.Object);

        await endpoint.HandleAsync(
            new GetClientLedgerEntriesRequest { Id = f.Client.PublicId },
            CancellationToken.None);

        endpoint.Response.Should().ContainSingle()
            .Which.ShipmentDeliveryDate.Should().Be(deliveryDate);
    }

    [Fact]
    public async Task Get_OrderOnNoShipment_HasNoDeliveryDate()
    {
        var f = BuildFixture();

        var entry = StoredProductEntry(f, planned: 10, actual: 7);
        entry.Client = f.Client;
        entry.Order = f.Order;

        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            clientLedgerEntries: [entry]);

        var endpoint = EndpointWithResponseBuilder<GetClientLedgerEntriesRequest, List<ClientLedgerEntryDto>, GetClientLedgerEntriesEndpoint>
            .Create(db.Object);

        await endpoint.HandleAsync(
            new GetClientLedgerEntriesRequest { Id = f.Client.PublicId },
            CancellationToken.None);

        endpoint.Response.Should().ContainSingle()
            .Which.ShipmentDeliveryDate.Should().BeNull();
    }
}
