using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Clients.Commands.Ledger.Assignment;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;
using Client = AleTrack.Entities.Client;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// Handing one open deviation to an order, and taking it back.
/// </summary>
/// <remarks>
/// The order screen's list of what a client still has open needs a one-click "this delivery will
/// sort it out". What it must NOT be is a one-click close: an entry settled on the promise would
/// stay settled even if the order were cancelled, which is the failure the whole feature exists
/// to prevent. So this endpoint only ever writes the link — the closing happens when the run
/// actually arrives.
/// </remarks>
public sealed class ClientLedgerAssignmentEndpointTests
{
    private const long ClientRowId = 11;
    private const long OrderRowId = 21;
    private const long OtherOrderRowId = 22;

    private sealed record Fixture(Client Client, Order Order, ClientLedgerEntry Entry);

    private static Fixture Build()
    {
        var client = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());
        client.Id = ClientRowId;

        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, state: OrderState.Planning);
        order.Id = OrderRowId;
        order.ClientId = client.Id;

        var entry = new ClientLedgerEntry
        {
            Id = 301,
            PublicId = Guid.NewGuid(),
            ClientId = ClientRowId,
            Target = ClientLedgerEntryTarget.ProductQuantity,
            LineName = "Ležák 12",
            PlannedQuantity = 10,
            ActualQuantity = 7,
            RequiresFollowUp = true,
            CreatedAt = new DateTime(2026, 8, 20, 9, 0, 0, DateTimeKind.Utc)
        };

        return new Fixture(client, order, entry);
    }

    private static Mock<AleTrackDbContext> BuildDb(Fixture f, params Order[] alsoOrders)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            orders: [f.Order, .. alsoOrders],
            clientLedgerEntries: [f.Entry]);

        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return db;
    }

    private static Task AssignAsync(Mock<AleTrackDbContext> db, Guid entryId, Guid? orderId)
    {
        var endpoint = EndpointBuilder<SetClientLedgerEntryAssignmentRequest, SetClientLedgerEntryAssignmentEndpoint>
            .Create(db.Object);

        return endpoint.HandleAsync(
            new SetClientLedgerEntryAssignmentRequest
            {
                Id = entryId,
                Data = new SetClientLedgerEntryAssignmentDto { OrderId = orderId },
            },
            CancellationToken.None);
    }

    // ---------------------------------------------------------------------------------
    // The promise.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task Assign_LinksTheOrderWithoutSettlingTheEntry()
    {
        var f = Build();
        var db = BuildDb(f);

        await AssignAsync(db, f.Entry.PublicId, f.Order.PublicId);

        f.Entry.ResolvedByOrderId.Should().Be(OrderRowId);
        f.Entry.ResolvedAt.Should().BeNull("promising is not delivering");
        f.Entry.ResolvedByUserId.Should().BeNull("nobody settled it by hand");
    }

    [Fact]
    public async Task Assign_ToTheOrderAlreadyCarryingIt_IsNotAConflict()
    {
        var f = Build();
        f.Entry.ResolvedByOrderId = OrderRowId;
        var db = BuildDb(f);

        await AssignAsync(db, f.Entry.PublicId, f.Order.PublicId);

        f.Entry.ResolvedByOrderId.Should().Be(OrderRowId);
    }

    [Fact]
    public async Task Release_TakesThePromiseBack()
    {
        var f = Build();
        f.Entry.ResolvedByOrderId = OrderRowId;
        var db = BuildDb(f);

        await AssignAsync(db, f.Entry.PublicId, orderId: null);

        f.Entry.ResolvedByOrderId.Should().BeNull();
        f.Entry.ResolvedAt.Should().BeNull();
    }

    // ---------------------------------------------------------------------------------
    // What it refuses.
    // ---------------------------------------------------------------------------------

    /// <summary>
    /// Two orders must not both promise the same three kegs: the first to arrive closes the
    /// entry and the second would be carrying nothing.
    /// </summary>
    [Fact]
    public async Task Assign_AnEntryAnotherOrderCarries_Conflicts()
    {
        var f = Build();
        f.Entry.ResolvedByOrderId = OtherOrderRowId;
        var db = BuildDb(f);

        var act = () => AssignAsync(db, f.Entry.PublicId, f.Order.PublicId);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.LedgerEntryAlreadyAssigned);
        f.Entry.ResolvedByOrderId.Should().Be(OtherOrderRowId);
    }

    [Fact]
    public async Task Assign_ASettledEntry_Conflicts()
    {
        var f = Build();
        f.Entry.ResolvedAt = new DateTime(2026, 8, 22, 9, 0, 0, DateTimeKind.Utc);
        var db = BuildDb(f);

        var act = () => AssignAsync(db, f.Entry.PublicId, f.Order.PublicId);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.LedgerEntryAlreadyResolved);
    }

    /// <summary>
    /// Releasing a settled entry is refused for the same reason: the link records which order
    /// settled it, and clearing that would lose the only trace of how it was closed.
    /// </summary>
    [Fact]
    public async Task Release_ASettledEntry_Conflicts()
    {
        var f = Build();
        f.Entry.ResolvedAt = new DateTime(2026, 8, 22, 9, 0, 0, DateTimeKind.Utc);
        f.Entry.ResolvedByOrderId = OrderRowId;
        var db = BuildDb(f);

        var act = () => AssignAsync(db, f.Entry.PublicId, orderId: null);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.LedgerEntryAlreadyResolved);
        f.Entry.ResolvedByOrderId.Should().Be(OrderRowId);
    }

    [Fact]
    public async Task Assign_AnotherClientsEntry_Conflicts()
    {
        var f = Build();
        f.Order.ClientId = 99;
        var db = BuildDb(f);

        var act = () => AssignAsync(db, f.Entry.PublicId, f.Order.PublicId);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.LedgerEntryClientMismatch);
        f.Entry.ResolvedByOrderId.Should().BeNull();
    }

    [Fact]
    public async Task Assign_UnknownEntry_IsNotFound()
    {
        var f = Build();
        var db = BuildDb(f);

        var act = () => AssignAsync(db, Guid.NewGuid(), f.Order.PublicId);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task Assign_UnknownOrder_IsNotFound()
    {
        var f = Build();
        var db = BuildDb(f);

        var act = () => AssignAsync(db, f.Entry.PublicId, Guid.NewGuid());

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
        f.Entry.ResolvedByOrderId.Should().BeNull();
    }
}
