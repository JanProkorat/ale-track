using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.SetState;
using AleTrack.Features.OutgoingShipments.Commands.SetStopCompletion;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Marking a stop finished from the vykládka while the run is on the road.
/// </summary>
/// <remarks>
/// Nobody tracks the van — the drivers ring in and the office writes it down — so the rules worth
/// pinning are about when the writing is allowed at all: only in transit, only on this run's own
/// stops, and never surviving a round that is taken back.
/// </remarks>
public sealed class StopCompletionEndpointTests
{
    private sealed record Fixture(OutgoingShipment Shipment, OutgoingShipmentStop Stop, Order Order);

    private static Fixture BuildFixture(OutgoingShipmentState state = OutgoingShipmentState.InTransit)
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        client.Id = 11;

        var order = OrderBuilder.BuildEntity(client: client, state: OrderState.Delivering, orderItems: []);
        order.Id = 101;
        order.ClientId = 11;

        var stop = new OutgoingShipmentStop
        {
            Id = 201,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            ClientOrder = order
        };

        var shipment = OutgoingShipmentBuilder.BuildEntity(state: state, stops: [stop]);
        // A fully planned run: EnsureReady refuses to move an unplanned one off the road at all,
        // and these tests are about the marks rather than about readiness.
        var vehicle = VehicleBuilder.BuildEntity();
        shipment.DeliveryDate = DateTime.UtcNow;
        shipment.Vehicle = vehicle;
        shipment.VehicleId = vehicle.Id;
        shipment.Drivers.Add(new OutgoingShipmentDriver { Driver = DriverBuilder.BuildEntity() });

        return new Fixture(shipment, stop, order);
    }

    private static Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> MockFor(Fixture f)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            orders: [f.Order], outgoingShipments: [f.Shipment]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return db;
    }

    private static SetStopCompletionEndpoint Endpoint(Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> db) =>
        EndpointBuilder<SetStopCompletionRequest, SetStopCompletionEndpoint>
            .Create(db.Object, DriverScopeMockFactory.Unscoped());

    private static SetStopCompletionRequest Request(Fixture f, bool isCompleted, Guid? stopId = null) => new()
    {
        Id = f.Shipment.PublicId,
        StopId = stopId ?? f.Stop.PublicId,
        Data = new SetStopCompletionDto { IsCompleted = isCompleted }
    };

    [Fact]
    public async Task SetCompletion_StampsTheTimeTheStopWasFinished()
    {
        var f = BuildFixture();
        var before = DateTime.UtcNow;

        await Endpoint(MockFor(f)).HandleAsync(Request(f, true), CancellationToken.None);

        f.Stop.CompletedAt.Should().NotBeNull();
        f.Stop.CompletedAt.Should().BeOnOrAfter(before);
    }

    /// <summary>Re-marking is a stray click, not a correction: the first time stands.</summary>
    [Fact]
    public async Task SetCompletion_OnAnAlreadyFinishedStop_KeepsTheFirstTime()
    {
        var f = BuildFixture();
        var first = new DateTime(2026, 8, 24, 12, 30, 0, DateTimeKind.Utc);
        f.Stop.CompletedAt = first;

        await Endpoint(MockFor(f)).HandleAsync(Request(f, true), CancellationToken.None);

        f.Stop.CompletedAt.Should().Be(first);
    }

    [Fact]
    public async Task SetCompletion_TakesTheMarkBack()
    {
        var f = BuildFixture();
        f.Stop.CompletedAt = DateTime.UtcNow;

        await Endpoint(MockFor(f)).HandleAsync(Request(f, false), CancellationToken.None);

        f.Stop.CompletedAt.Should().BeNull();
    }

    /// <summary>
    /// Before departure there is nothing to have finished, and once the run is delivered or
    /// cancelled its stops are a record rather than a progress note.
    /// </summary>
    [Theory]
    [InlineData(OutgoingShipmentState.Created)]
    [InlineData(OutgoingShipmentState.Loaded)]
    [InlineData(OutgoingShipmentState.Delivered)]
    [InlineData(OutgoingShipmentState.Cancelled)]
    public async Task SetCompletion_OnARunThatIsNotOnTheRoad_IsRejected(OutgoingShipmentState state)
    {
        var f = BuildFixture(state);

        var act = async () => await Endpoint(MockFor(f)).HandleAsync(Request(f, true), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
        f.Stop.CompletedAt.Should().BeNull();
    }

    /// <summary>A stop of another run reads as not found rather than marking someone else's route.</summary>
    [Fact]
    public async Task SetCompletion_OnAStopOfAnotherRun_IsNotFound()
    {
        var f = BuildFixture();

        var act = async () => await Endpoint(MockFor(f))
            .HandleAsync(Request(f, true, Guid.NewGuid()), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task SetCompletion_OnAMissingShipment_IsNotFound()
    {
        var f = BuildFixture();

        var act = async () => await Endpoint(MockFor(f)).HandleAsync(
            new SetStopCompletionRequest
            {
                Id = Guid.NewGuid(),
                StopId = f.Stop.PublicId,
                Data = new SetStopCompletionDto { IsCompleted = true }
            },
            CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    /// <summary>
    /// The marks describe one journey. A run taken off the road is about to do the round again (or
    /// never did it), so it must not start with stops already ticked off.
    /// </summary>
    [Theory]
    [InlineData(OutgoingShipmentState.Loaded)]
    [InlineData(OutgoingShipmentState.Cancelled)]
    public async Task LeavingTheRoad_ClearsEveryStopsMark(OutgoingShipmentState next)
    {
        var f = BuildFixture();
        f.Stop.CompletedAt = DateTime.UtcNow;

        await EndpointBuilder<SetShipmentStateRequest, SetShipmentStateEndpoint>
            .Create(MockFor(f).Object, DriverScopeMockFactory.Unscoped())
            .HandleAsync(
                new SetShipmentStateRequest
                {
                    Id = f.Shipment.PublicId,
                    Data = new SetShipmentStateDto { State = next }
                },
                CancellationToken.None);

        f.Stop.CompletedAt.Should().BeNull();
    }

    /// <summary>Delivering the run keeps them: that is the record of how the round went.</summary>
    [Fact]
    public async Task DeliveringTheRun_KeepsTheMarks()
    {
        var f = BuildFixture();
        var finished = new DateTime(2026, 8, 24, 14, 32, 0, DateTimeKind.Utc);
        f.Stop.CompletedAt = finished;

        await EndpointBuilder<SetShipmentStateRequest, SetShipmentStateEndpoint>
            .Create(MockFor(f).Object, DriverScopeMockFactory.Unscoped())
            .HandleAsync(
                new SetShipmentStateRequest
                {
                    Id = f.Shipment.PublicId,
                    Data = new SetShipmentStateDto { State = OutgoingShipmentState.Delivered }
                },
                CancellationToken.None);

        f.Stop.CompletedAt.Should().Be(finished);
    }
}
