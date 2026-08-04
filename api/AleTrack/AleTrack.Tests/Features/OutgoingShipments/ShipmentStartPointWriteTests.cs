using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;
using FluentValidation.TestHelper;
using Microsoft.Extensions.Options;
using static AleTrack.Tests.Features.OutgoingShipments.OutgoingShipmentTestHelpers;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Writing a start point: what persists, what is rejected, and when it freezes.
/// </summary>
public sealed class ShipmentStartPointWriteTests
{
    [Fact]
    public async Task HandleAsync_StartPointIsBrewery_PersistsTheBrewery()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Svijany");
        brewery.Id = 7;
        var (shipment, request, dbContext) = Arrange(OutgoingShipmentState.Created, [brewery]);

        request.Data.StartPointKind = ShipmentStartPointKind.Brewery;
        request.Data.StartBreweryId = brewery.PublicId;

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()));

        await endpoint.HandleAsync(request, CancellationToken.None);

        shipment.StartPointKind.Should().Be(ShipmentStartPointKind.Brewery);
        shipment.StartBrewery.Should().Be(brewery);
        shipment.StartBreweryId.Should().Be(brewery.Id);
    }

    [Fact]
    public async Task HandleAsync_UnknownStartBreweryId_Returns404()
    {
        var (_, request, dbContext) = Arrange(OutgoingShipmentState.Created, []);

        request.Data.StartPointKind = ShipmentStartPointKind.Brewery;
        request.Data.StartBreweryId = Guid.NewGuid();

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()));

        var act = async () => await endpoint.HandleAsync(request, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_StartPointChangedOnLoadedShipment_IsRejectedAsFrozenContent()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Svijany");
        var (_, request, dbContext) = Arrange(OutgoingShipmentState.Loaded, [brewery]);

        request.Data.State = OutgoingShipmentState.Loaded;
        request.Data.StartPointKind = ShipmentStartPointKind.Brewery;
        request.Data.StartBreweryId = brewery.PublicId;

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()));

        var act = async () => await endpoint.HandleAsync(request, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentContentFrozen);
    }

    [Fact]
    public void Validate_StartPointKindCompanyWithBreweryId_FailsValidation()
    {
        var dto = OutgoingShipmentBuilder.BuildUpdateDto();
        dto.StartPointKind = ShipmentStartPointKind.Company;
        dto.StartBreweryId = Guid.NewGuid();

        var result = new UpdateOutgoingShipmentDtoValidator().TestValidate(dto);

        result.ShouldHaveValidationErrorFor(d => d.StartBreweryId);
    }

    [Fact]
    public void Validate_StartPointKindBreweryWithoutBreweryId_FailsValidation()
    {
        var dto = OutgoingShipmentBuilder.BuildUpdateDto();
        dto.StartPointKind = ShipmentStartPointKind.Brewery;
        dto.StartBreweryId = null;

        var result = new UpdateOutgoingShipmentDtoValidator().TestValidate(dto);

        result.ShouldHaveValidationErrorFor(d => d.StartBreweryId);
    }

    // Arrange(state, breweries) is shared with CompanyStopTests — see
    // OutgoingShipmentTestHelpers, imported above via `using static`.
}
