using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.AcknowledgeAddressChanges;
using AleTrack.Features.OutgoingShipments.Commands.Create;
using AleTrack.Features.OutgoingShipments.Commands.Delete;
using AleTrack.Features.OutgoingShipments.Commands.SetLoadingState;
using AleTrack.Features.OutgoingShipments.Commands.SetPreparationStep;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Features.OutgoingShipments.Queries.Export;
using AleTrack.Features.OutgoingShipments.Queries.Invoices;
using AleTrack.Features.OutgoingShipments.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace AleTrack.Tests.Features.OutgoingShipments;

public sealed class ShipmentDriverScopingTests
{
    [Fact]
    public async Task HandleAsync_DriverScopedCaller_ListReturnsOnlyAssignedShipments()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [ShipmentAssignedTo(1, "Mine"), ShipmentAssignedTo(2, "Theirs")]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<OutgoingShipmentListItemDto>, GetOutgoingShipmentsListEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().HaveCount(1);
        endpoint.Response[0].Name.Should().Be("Mine");
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerUnlinked_ListReturnsEmpty()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [ShipmentAssignedTo(1, "Mine"), ShipmentAssignedTo(2, "Theirs")]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<OutgoingShipmentListItemDto>, GetOutgoingShipmentsListEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.ScopedUnlinked());

        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_UnscopedCaller_ListReturnsEveryShipment()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [ShipmentAssignedTo(1, "Mine"), ShipmentAssignedTo(2, "Theirs")]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<OutgoingShipmentListItemDto>, GetOutgoingShipmentsListEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().HaveCount(2);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerNotAssigned_DetailIsNotFound()
    {
        var theirs = ShipmentAssignedTo(2, "Theirs");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [theirs]);

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Scoped(1));

        var act = async () => await endpoint.HandleAsync(
            new GetOutgoingShipmentDetailRequest { Id = theirs.PublicId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerUnlinked_DetailIsNotFound()
    {
        var mine = ShipmentAssignedTo(1, "Mine");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [mine]);

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.ScopedUnlinked());

        var act = async () => await endpoint.HandleAsync(
            new GetOutgoingShipmentDetailRequest { Id = mine.PublicId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerNotAssigned_ExcelExportIsNotFound()
    {
        var theirs = ShipmentAssignedTo(2, "Theirs");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [theirs]);

        var endpoint = EndpointBuilder<ExportOutgoingShipmentRequest, ExportOutgoingShipmentExcelEndpoint>
            .Create(
                dbContext.Object,
                Options.Create(new CompanyOptions()),
                DriverScopeMockFactory.Scoped(1),
                TimeProvider.System);

        var act = async () => await endpoint.HandleAsync(
            new ExportOutgoingShipmentRequest
            {
                Id = theirs.PublicId,
                // Anything at all: the scope guard runs before the selection is looked at.
                Data = new ExportOutgoingShipmentDto { ClientIds = [Guid.NewGuid()] }
            },
            CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerNotAssigned_WordExportIsNotFound()
    {
        var theirs = ShipmentAssignedTo(2, "Theirs");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [theirs]);

        var endpoint = EndpointBuilder<ExportOutgoingShipmentRequest, ExportOutgoingShipmentWordEndpoint>
            .Create(
                dbContext.Object,
                Options.Create(new CompanyOptions()),
                DriverScopeMockFactory.Scoped(1),
                TimeProvider.System);

        var act = async () => await endpoint.HandleAsync(
            new ExportOutgoingShipmentRequest
            {
                Id = theirs.PublicId,
                // Anything at all: the scope guard runs before the selection is looked at.
                Data = new ExportOutgoingShipmentDto { ClientIds = [Guid.NewGuid()] }
            },
            CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCaller_DeleteShipmentIsForbidden()
    {
        var mine = ShipmentAssignedTo(1, "Mine");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [mine]);

        var endpoint = EndpointBuilder<DeleteOutgoingShipmentRequest, DeleteOutgoingShipmentEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        var act = async () => await endpoint.HandleAsync(
            new DeleteOutgoingShipmentRequest { Id = mine.PublicId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.DriverScopeForbidden);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerNotAssigned_SetPreparationStepIsNotFound()
    {
        var theirs = ShipmentAssignedTo(2, "Theirs");
        // A real step, so an unguarded call would otherwise find it and succeed — the guard,
        // not a missing-step 404, is what this test has to exercise.
        var step = new OutgoingShipmentPreparationStep { PublicId = Guid.NewGuid(), Label = "Naložit" };
        theirs.PreparationSteps.Add(step);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [theirs]);

        var endpoint = EndpointBuilder<SetPreparationStepRequest, SetPreparationStepEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        var act = async () => await endpoint.HandleAsync(
            new SetPreparationStepRequest { Id = theirs.PublicId, StepId = step.PublicId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCaller_CreateShipmentIsForbidden()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointBuilder<CreateOutgoingShipmentRequest, CreateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Scoped(1));

        var act = async () => await endpoint.HandleAsync(
            new CreateOutgoingShipmentRequest { Data = new CreateOutgoingShipmentDto() }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.DriverScopeForbidden);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerNotAssigned_UpdateIsNotFound()
    {
        var theirs = ShipmentAssignedTo(2, "Theirs");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [theirs]);

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Scoped(1), AppContextMockFactory.Anonymous());

        var act = async () => await endpoint.HandleAsync(
            new UpdateOutgoingShipmentRequest { Id = theirs.PublicId, Data = new UpdateOutgoingShipmentDto() },
            CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerNotAssigned_AcknowledgeAddressChangesIsNotFound()
    {
        var theirs = ShipmentAssignedTo(2, "Theirs");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [theirs]);

        var endpoint = EndpointWithoutRequestBuilder<AcknowledgeAddressChangesEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));
        endpoint.HttpContext.Request.RouteValues["Id"] = theirs.PublicId.ToString();

        var act = async () => await endpoint.HandleAsync(CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerNotAssigned_SetLoadingStateIsNotFound()
    {
        var theirs = ShipmentAssignedTo(2, "Theirs");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [theirs]);

        var endpoint = EndpointBuilder<SetLoadingStateRequest, SetLoadingStateEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        var act = async () => await endpoint.HandleAsync(
            new SetLoadingStateRequest { Id = theirs.PublicId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerNotAssigned_GetShipmentInvoicesIsNotFound()
    {
        var theirs = ShipmentAssignedTo(2, "Theirs");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [theirs]);

        var endpoint = EndpointWithResponseBuilder<GetShipmentInvoicesRequest, ShipmentInvoicesDto, GetShipmentInvoicesEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        var act = async () => await endpoint.HandleAsync(
            new GetShipmentInvoicesRequest { Id = theirs.PublicId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    private static OutgoingShipment ShipmentAssignedTo(long driverId, string name)
        => OutgoingShipmentBuilder.BuildEntity(
            name: name,
            drivers: [new OutgoingShipmentDriver { DriverId = driverId }]);
}
