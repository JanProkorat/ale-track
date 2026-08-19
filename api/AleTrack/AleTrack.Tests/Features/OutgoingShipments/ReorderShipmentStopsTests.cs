using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.ReorderStops;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Resequencing a run's stops. The narrow endpoint behind the stop list's own reorder controls,
/// and the only way to place an auto-derived pickup stop — the editor keeps those out of its
/// draft entirely.
/// </summary>
public sealed class ReorderShipmentStopsTests
{
    [Fact]
    public async Task HandleAsync_NewSequence_RenumbersEveryStopFromOne()
    {
        var f = Arrange(OutgoingShipmentState.Created);

        // Reversed: last first.
        await Act(f, [f.Supplier.PublicId, f.Company.PublicId, f.Order.PublicId]);

        f.Order.Order.Should().Be(3);
        f.Company.Order.Should().Be(2);
        f.Supplier.Order.Should().Be(1);
        f.DbContext.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// The case the editor cannot cover: a supplier pickup stop is derived by the server and
    /// never round-tripped through the shipment PUT, so this endpoint is the only thing that
    /// can put it mid-route.
    /// </summary>
    [Fact]
    public async Task HandleAsync_MovesASupplierStopIntoTheMiddle()
    {
        var f = Arrange(OutgoingShipmentState.Created);

        await Act(f, [f.Order.PublicId, f.Supplier.PublicId, f.Company.PublicId]);

        f.Supplier.Order.Should().Be(2);
    }

    [Fact]
    public async Task HandleAsync_UnknownShipment_ReportsNotFound()
    {
        var f = Arrange(OutgoingShipmentState.Created);

        var endpoint = EndpointBuilder<ReorderShipmentStopsRequest, ReorderShipmentStopsEndpoint>
            .Create(f.DbContext.Object, DriverScopeMockFactory.Unscoped());

        var act = async () => await endpoint.HandleAsync(
            new ReorderShipmentStopsRequest
            {
                Id = Guid.NewGuid(),
                Data = new ReorderShipmentStopsDto { StopIds = [f.Order.PublicId] }
            },
            CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>();
    }

    /// <summary>
    /// A sequence only means something as a whole: an omitted stop would be left with no
    /// position at all.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PartialList_IsRejectedAndChangesNothing()
    {
        var f = Arrange(OutgoingShipmentState.Created);

        var act = async () => await Act(f, [f.Supplier.PublicId, f.Order.PublicId]);

        await act.Should().ThrowAsync<AleTrackException>();
        f.Order.Order.Should().Be(1);
        f.Company.Order.Should().Be(2);
        f.Supplier.Order.Should().Be(3);
        f.DbContext.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    /// <summary>A stale client working from a route this run no longer has.</summary>
    [Fact]
    public async Task HandleAsync_UnknownStop_IsRejected()
    {
        var f = Arrange(OutgoingShipmentState.Created);

        var act = async () => await Act(f, [f.Order.PublicId, f.Company.PublicId, Guid.NewGuid()]);

        await act.Should().ThrowAsync<AleTrackException>();
        f.Supplier.Order.Should().Be(3);
    }

    [Fact]
    public async Task HandleAsync_DuplicatedStop_IsRejected()
    {
        var f = Arrange(OutgoingShipmentState.Created);

        var act = async () => await Act(f, [f.Order.PublicId, f.Order.PublicId, f.Company.PublicId]);

        await act.Should().ThrowAsync<AleTrackException>();
    }

    /// <summary>
    /// Sequence is content: the export, the unload list and the invoice ordering all read it,
    /// and the snapshot written when the truck is packed depends on it. So it freezes with
    /// everything else.
    /// </summary>
    [Theory]
    [InlineData(OutgoingShipmentState.Loaded)]
    [InlineData(OutgoingShipmentState.InTransit)]
    [InlineData(OutgoingShipmentState.Delivered)]
    [InlineData(OutgoingShipmentState.Cancelled)]
    public async Task HandleAsync_OnceThePlanningIsOver_IsRejected(OutgoingShipmentState state)
    {
        var f = Arrange(state);

        var act = async () => await Act(f, [f.Supplier.PublicId, f.Company.PublicId, f.Order.PublicId]);

        await act.Should().ThrowAsync<AleTrackException>();
        f.Order.Order.Should().Be(1);
    }

    private sealed record Fixture(
        OutgoingShipment Shipment,
        OutgoingShipmentStop Order,
        OutgoingShipmentStop Company,
        OutgoingShipmentStop Supplier,
        Mock<AleTrackDbContext> DbContext);

    private static Fixture Arrange(OutgoingShipmentState state)
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client);

        var orderStop = new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(), Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order
        };
        var companyStop = new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(), Order = 2, Kind = OutgoingShipmentStopKind.Company, Label = "Sklad AleTrack"
        };
        var supplierStop = new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(), Order = 3, Kind = OutgoingShipmentStopKind.Supplier, Label = "Linde Gas"
        };

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: Guid.NewGuid(), state: state, stops: [orderStop, companyStop, supplierStop]);

        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], outgoingShipments: [shipment]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        return new Fixture(shipment, orderStop, companyStop, supplierStop, db);
    }

    private static async Task Act(Fixture f, List<Guid> stopIds)
    {
        var endpoint = EndpointBuilder<ReorderShipmentStopsRequest, ReorderShipmentStopsEndpoint>
            .Create(f.DbContext.Object, DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(
            new ReorderShipmentStopsRequest
            {
                Id = f.Shipment.PublicId,
                Data = new ReorderShipmentStopsDto { StopIds = stopIds }
            },
            CancellationToken.None);
    }
}
