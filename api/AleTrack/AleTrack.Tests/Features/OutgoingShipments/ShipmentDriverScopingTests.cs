using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Features.OutgoingShipments.Queries.Export;
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
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Scoped(1));

        var act = async () => await endpoint.HandleAsync(
            new ExportOutgoingShipmentRequest { Id = theirs.PublicId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerNotAssigned_WordExportIsNotFound()
    {
        var theirs = ShipmentAssignedTo(2, "Theirs");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [theirs]);

        var endpoint = EndpointBuilder<ExportOutgoingShipmentRequest, ExportOutgoingShipmentWordEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Scoped(1));

        var act = async () => await endpoint.HandleAsync(
            new ExportOutgoingShipmentRequest { Id = theirs.PublicId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    private static OutgoingShipment ShipmentAssignedTo(long driverId, string name)
        => OutgoingShipmentBuilder.BuildEntity(
            name: name,
            drivers: [new OutgoingShipmentDriver { DriverId = driverId }]);
}
