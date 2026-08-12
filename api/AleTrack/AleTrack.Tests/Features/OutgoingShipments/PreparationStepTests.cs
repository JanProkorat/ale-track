using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.SetPreparationStep;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The preparation checklist is written in the editor and ticked on the detail screen, so the two
/// write paths must not undo each other: a save from the editor keeps the ticks, and a tick keeps
/// the list.
/// </summary>
public sealed class PreparationStepTests
{
    #region ticking

    [Fact]
    public async Task SetStep_TicksIt()
    {
        var f = Fixture.Build();

        await Tick(f, f.FirstStepId, isDone: true);

        f.Step("Naložit vratky").IsDone.Should().BeTrue();
        f.DbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SetStep_UnticksIt()
    {
        var f = Fixture.Build();
        f.Step("Naložit vratky").IsDone = true;

        await Tick(f, f.FirstStepId, isDone: false);

        f.Step("Naložit vratky").IsDone.Should().BeFalse("a mis-tick has to be reversible");
    }

    [Fact]
    public async Task SetStep_TouchesOnlyTheStepAsked()
    {
        var f = Fixture.Build();

        await Tick(f, f.FirstStepId, isDone: true);

        f.Step("Zkontrolovat doklady").IsDone.Should().BeFalse();
    }

    [Theory]
    [InlineData(OutgoingShipmentState.Loaded)]
    [InlineData(OutgoingShipmentState.InTransit)]
    public async Task SetStep_WhileTheRunIsUnderWay_IsAllowed(OutgoingShipmentState state)
    {
        // Preparation carries on after the truck is packed, so ticking follows the loading rule
        // rather than the content rule, which freezes in Created.
        var f = Fixture.Build(state);

        await Tick(f, f.FirstStepId, isDone: true);

        f.Step("Naložit vratky").IsDone.Should().BeTrue();
    }

    [Theory]
    [InlineData(OutgoingShipmentState.Delivered)]
    [InlineData(OutgoingShipmentState.Cancelled)]
    public async Task SetStep_OnAFinishedShipment_IsRejected(OutgoingShipmentState state)
    {
        var f = Fixture.Build(state);

        var act = async () => await Tick(f, f.FirstStepId, isDone: true);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task SetStep_OfAnotherShipment_IsNotFound()
    {
        var f = Fixture.Build();
        var foreignStep = new OutgoingShipmentPreparationStep { PublicId = Guid.NewGuid(), Label = "Cizí krok" };

        var act = async () => await Tick(f, foreignStep.PublicId, isDone: true);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task SetStep_UnknownShipment_IsNotFound()
    {
        var f = Fixture.Build();
        var endpoint = EndpointBuilder<SetPreparationStepRequest, SetPreparationStepEndpoint>.Create(f.DbContext.Object, DriverScopeMockFactory.Unscoped());

        var act = async () => await endpoint.HandleAsync(new SetPreparationStepRequest
        {
            Id = Guid.NewGuid(),
            StepId = f.FirstStepId,
            Data = new SetPreparationStepDto { IsDone = true },
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    #endregion

    #region what the editor's save does to the ticks

    [Fact]
    public async Task Update_ExistingStep_KeepsItsTick()
    {
        // The whole point of matching by ID: reordering or rewording the list must not reset the
        // progress already made against it.
        var f = Fixture.Build();
        f.Step("Naložit vratky").IsDone = true;
        // Held onto because the save below rewords the step, and the label is how the fixture
        // otherwise finds it.
        var renamedStepId = f.FirstStepId;

        await Save(f, [
            new PreparationStepDto { Id = renamedStepId, Order = 2, Label = "Naložit vratky (nejdřív)" },
            new PreparationStepDto { Id = f.SecondStepId, Order = 1, Label = "Zkontrolovat doklady" },
        ]);

        var kept = f.Shipment.PreparationSteps.Single(s => s.PublicId == renamedStepId);
        kept.IsDone.Should().BeTrue();
        kept.Order.Should().Be(2);
        kept.Label.Should().Be("Naložit vratky (nejdřív)");
    }

    [Fact]
    public async Task Update_NewStep_StartsUnticked()
    {
        var f = Fixture.Build();

        await Save(f, [
            ..f.EchoSteps(),
            new PreparationStepDto { Order = 3, Label = "Umýt vůz" },
        ]);

        f.Shipment.PreparationSteps.Should().HaveCount(3);
        f.Step("Umýt vůz").IsDone.Should().BeFalse();
        f.Step("Umýt vůz").PublicId.Should().NotBeEmpty("the detail screen ticks steps by public ID");
    }

    [Fact]
    public async Task Update_StepMissingFromTheRequest_IsDropped()
    {
        var f = Fixture.Build();

        await Save(f, [new PreparationStepDto { Id = f.SecondStepId, Order = 1, Label = "Zkontrolovat doklady" }]);

        f.Shipment.PreparationSteps.Should().ContainSingle()
            .Which.PublicId.Should().Be(f.SecondStepId);
    }

    [Fact]
    public async Task Update_EmptyList_ClearsTheChecklist()
    {
        var f = Fixture.Build();

        await Save(f, []);

        f.Shipment.PreparationSteps.Should().BeEmpty();
    }

    [Fact]
    public async Task Update_OfALoadedShipment_MayStillChangeTheChecklist()
    {
        // The checklist is not frozen content: it is worked through while the run is under way.
        var f = Fixture.Build(OutgoingShipmentState.Loaded);

        await Save(f, [..f.EchoSteps(), new PreparationStepDto { Order = 3, Label = "Umýt vůz" }]);

        f.Shipment.PreparationSteps.Should().HaveCount(3);
    }

    [Theory]
    [InlineData(OutgoingShipmentState.Delivered)]
    [InlineData(OutgoingShipmentState.Cancelled)]
    public async Task Update_OfAFinishedShipment_CannotChangeTheChecklist(OutgoingShipmentState state)
    {
        var f = Fixture.Build(state);

        var act = async () => await Save(f, [..f.EchoSteps(), new PreparationStepDto { Order = 3, Label = "Umýt vůz" }]);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.ShipmentContentFrozen);
    }

    [Fact]
    public async Task Update_OfADeliveredShipment_PassesWhenTheChecklistIsUnchanged()
    {
        // Every save re-sends the whole shipment, so an untouched checklist must not trip the guard.
        var f = Fixture.Build(OutgoingShipmentState.Delivered);

        var act = async () => await Save(f, f.EchoSteps());

        await act.Should().NotThrowAsync();
    }

    #endregion

    #region helpers

    private static async Task Tick(Fixture f, Guid stepId, bool isDone)
    {
        var endpoint = EndpointBuilder<SetPreparationStepRequest, SetPreparationStepEndpoint>.Create(f.DbContext.Object, DriverScopeMockFactory.Unscoped());
        await endpoint.HandleAsync(new SetPreparationStepRequest
        {
            Id = f.Shipment.PublicId,
            StepId = stepId,
            Data = new SetPreparationStepDto { IsDone = isDone },
        }, CancellationToken.None);
    }

    private static async Task Save(Fixture f, List<PreparationStepDto> steps)
    {
        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(f.DbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());
        await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = f.EchoDto(steps),
        }, CancellationToken.None);
    }

    /// <summary>
    /// A shipment with everything <c>HasFilledData</c> wants — so the pre-existing "not prepared"
    /// check cannot mask what these tests assert — and a two-step checklist.
    /// </summary>
    private sealed class Fixture
    {
        internal required OutgoingShipment Shipment { get; init; }
        internal required Order Order { get; init; }
        internal required Vehicle Vehicle { get; init; }
        internal required Driver Driver { get; init; }
        internal required Mock<AleTrackDbContext> DbContext { get; init; }

        internal Guid FirstStepId => Step("Naložit vratky").PublicId;
        internal Guid SecondStepId => Step("Zkontrolovat doklady").PublicId;

        internal OutgoingShipmentPreparationStep Step(string label) =>
            Shipment.PreparationSteps.Single(s => s.Label == label);

        /// <summary>The checklist as the editor would re-send it, unchanged.</summary>
        internal List<PreparationStepDto> EchoSteps() =>
        [
            ..Shipment.PreparationSteps
                .OrderBy(s => s.Order)
                .Select(s => new PreparationStepDto { Id = s.PublicId, Order = s.Order, Label = s.Label })
        ];

        /// <summary>The whole current content, as the UI re-sends it on every save.</summary>
        internal UpdateOutgoingShipmentDto EchoDto(List<PreparationStepDto> steps) => new()
        {
            Name = "Rozvoz",
            DeliveryDate = Shipment.DeliveryDate,
            VehicleId = Vehicle.PublicId,
            DriverIds = [Driver.PublicId],
            State = Shipment.State,
            ClientOrderShipments = [new ClientOrderShipmentDto { ClientOrderId = Order.PublicId, Order = 1 }],
            PreparationSteps = steps,
        };

        internal static Fixture Build(OutgoingShipmentState state = OutgoingShipmentState.Created)
        {
            var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
            var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, state: OrderState.Planning);

            var vehicle = VehicleBuilder.BuildEntity(publicId: Guid.NewGuid());
            vehicle.Id = 21;
            var driver = DriverBuilder.BuildEntity(publicId: Guid.NewGuid());

            var shipment = OutgoingShipmentBuilder.BuildEntity(
                publicId: Guid.NewGuid(),
                deliveryDate: DateTime.UtcNow.AddDays(1),
                state: state,
                vehicle: vehicle,
                drivers: [new OutgoingShipmentDriver { Driver = driver }],
                stops:
                [
                    new OutgoingShipmentStop
                    {
                        PublicId = Guid.NewGuid(),
                        Kind = OutgoingShipmentStopKind.Order,
                        Order = 1,
                        ClientOrder = order
                    }
                ]);
            shipment.VehicleId = vehicle.Id;
            shipment.PreparationSteps =
            [
                new OutgoingShipmentPreparationStep
                {
                    Id = 1, PublicId = Guid.NewGuid(), OutgoingShipment = shipment, Order = 1, Label = "Naložit vratky"
                },
                new OutgoingShipmentPreparationStep
                {
                    Id = 2, PublicId = Guid.NewGuid(), OutgoingShipment = shipment, Order = 2, Label = "Zkontrolovat doklady"
                }
            ];

            var db = AleTrackDbContextMockFactory.CreateMock(
                outgoingShipments: [shipment],
                orders: [order],
                vehicles: [vehicle],
                drivers: [driver]);
            db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            return new Fixture
            {
                Shipment = shipment, Order = order, Vehicle = vehicle, Driver = driver, DbContext = db
            };
        }
    }

    #endregion
}
