using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Drivers.Commands.Create;
using AleTrack.Features.Drivers.Commands.Delete;
using AleTrack.Features.Drivers.Commands.Update;
using AleTrack.Features.Drivers.Queries.Detail;
using AleTrack.Features.Drivers.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Drivers;

public sealed class DriverScopingTests
{
    [Fact]
    public async Task HandleAsync_DriverScopedCaller_ListReturnsOnlyOwnRecord()
    {
        var mine = DriverBuilder.BuildEntity(id: 1, firstName: "Mine");
        var other = DriverBuilder.BuildEntity(id: 2, firstName: "Other");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(drivers: [mine, other]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<DriverListItemDto>, GetDriversListEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().HaveCount(1);
        endpoint.Response[0].FirstName.Should().Be("Mine");
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerUnlinked_ListReturnsEmpty()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [DriverBuilder.BuildEntity(id: 1), DriverBuilder.BuildEntity(id: 2)]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<DriverListItemDto>, GetDriversListEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.ScopedUnlinked());

        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_UnscopedCaller_ListReturnsEveryRecord()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [DriverBuilder.BuildEntity(id: 1), DriverBuilder.BuildEntity(id: 2)]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<DriverListItemDto>, GetDriversListEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().HaveCount(2);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerOtherDriver_DetailIsNotFound()
    {
        var otherId = Guid.NewGuid();
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [DriverBuilder.BuildEntity(id: 1), DriverBuilder.BuildEntity(id: 2, publicId: otherId)]);

        var endpoint = EndpointWithResponseBuilder<GetDriverDetailRequest, DriverDto, GetDriverDetailEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        var act = async () => await endpoint.HandleAsync(new GetDriverDetailRequest { Id = otherId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerOwnRecord_DetailIsReturned()
    {
        var mineId = Guid.NewGuid();
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [DriverBuilder.BuildEntity(id: 1, publicId: mineId)]);

        var endpoint = EndpointWithResponseBuilder<GetDriverDetailRequest, DriverDto, GetDriverDetailEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        await endpoint.HandleAsync(new GetDriverDetailRequest { Id = mineId }, CancellationToken.None);

        endpoint.Response.Id.Should().Be(mineId);
    }

    [Fact]
    public async Task HandleAsync_ScopedUnlinkedCaller_DetailIsNotFound()
    {
        var mineId = Guid.NewGuid();
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [DriverBuilder.BuildEntity(id: 1, publicId: mineId)]);

        var endpoint = EndpointWithResponseBuilder<GetDriverDetailRequest, DriverDto, GetDriverDetailEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.ScopedUnlinked());

        var act = async () => await endpoint.HandleAsync(new GetDriverDetailRequest { Id = mineId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCaller_DeleteIsForbidden()
    {
        var mineId = Guid.NewGuid();
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [DriverBuilder.BuildEntity(id: 1, publicId: mineId)]);

        var endpoint = EndpointBuilder<DeleteDriverRequest, DeleteDriverEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        var act = async () => await endpoint.HandleAsync(new DeleteDriverRequest { Id = mineId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.DriverScopeForbidden);

        dbContext.Verify(e => e.Drivers.Remove(It.IsAny<AleTrack.Entities.Driver>()), Times.Never);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCaller_CreateIsForbidden()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointBuilder<CreateDriverRequest, CreateDriverEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        var command = new CreateDriverRequest { Data = DriverBuilder.BuildCreateDto() };

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.DriverScopeForbidden);

        dbContext.Verify(e => e.Drivers.Add(It.IsAny<AleTrack.Entities.Driver>()), Times.Never);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerOtherDriver_UpdateIsNotFound()
    {
        var otherId = Guid.NewGuid();
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [DriverBuilder.BuildEntity(id: 1), DriverBuilder.BuildEntity(id: 2, publicId: otherId)]);

        var endpoint = EndpointBuilder<UpdateDriverRequest, UpdateDriverEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        var command = new UpdateDriverRequest { Id = otherId, Data = DriverBuilder.BuildUpdateDto() };

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerOwnRecord_UpdateSucceeds()
    {
        var mineId = Guid.NewGuid();
        var driver = DriverBuilder.BuildEntity(id: 1, publicId: mineId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(drivers: [driver]);

        var endpoint = EndpointBuilder<UpdateDriverRequest, UpdateDriverEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Scoped(1));

        var command = new UpdateDriverRequest { Id = mineId, Data = DriverBuilder.BuildUpdateDto(firstName: "Updated") };

        await endpoint.HandleAsync(command, CancellationToken.None);

        driver.FirstName.Should().Be("Updated");
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_ScopedUnlinkedCaller_UpdateIsNotFound()
    {
        var mineId = Guid.NewGuid();
        var driver = DriverBuilder.BuildEntity(id: 1, publicId: mineId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(drivers: [driver]);

        var endpoint = EndpointBuilder<UpdateDriverRequest, UpdateDriverEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.ScopedUnlinked());

        var command = new UpdateDriverRequest { Id = mineId, Data = DriverBuilder.BuildUpdateDto() };

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
