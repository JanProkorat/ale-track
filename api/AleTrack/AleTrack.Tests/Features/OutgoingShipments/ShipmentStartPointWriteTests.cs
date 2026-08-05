using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Features.OutgoingShipments.Commands.Create;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
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

    /// <summary>
    /// A brewery has no delivery-place navigation, so <c>DeliveryPlace</c> is never a
    /// legal value here — unlike <see cref="ClientOrderShipmentDto.SelectedAddressKind"/>,
    /// which does support it. Guards against silently accepting a value the endpoint has
    /// nowhere to resolve.
    /// </summary>
    [Fact]
    public void Validate_UpdateStartBreweryAddressKindDeliveryPlace_FailsValidation()
    {
        var dto = OutgoingShipmentBuilder.BuildUpdateDto();
        dto.StartPointKind = ShipmentStartPointKind.Brewery;
        dto.StartBreweryId = Guid.NewGuid();
        dto.StartBreweryAddressKind = DeliveryAddressKind.DeliveryPlace;

        var result = new UpdateOutgoingShipmentDtoValidator().TestValidate(dto);

        result.ShouldHaveValidationErrorFor(d => d.StartBreweryAddressKind);
    }

    [Fact]
    public void Validate_CreateStartBreweryAddressKindDeliveryPlace_FailsValidation()
    {
        var dto = OutgoingShipmentBuilder.BuildCreateDto();
        dto.StartPointKind = ShipmentStartPointKind.Brewery;
        dto.StartBreweryId = Guid.NewGuid();
        dto.StartBreweryAddressKind = DeliveryAddressKind.DeliveryPlace;

        var result = new CreateOutgoingShipmentDtoValidator().TestValidate(dto);

        result.ShouldHaveValidationErrorFor(d => d.StartBreweryAddressKind);
    }

    /// <summary>
    /// The frontend merely hides the option; nothing stops a direct caller from asking
    /// for a contact address the brewery does not have.
    /// </summary>
    [Fact]
    public async Task HandleAsync_StartBreweryAddressKindContactButBreweryHasNoContactAddress_ThrowsBadRequest()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Svijany"); // no contact address
        var (_, request, dbContext) = Arrange(OutgoingShipmentState.Created, [brewery]);

        request.Data.StartPointKind = ShipmentStartPointKind.Brewery;
        request.Data.StartBreweryId = brewery.PublicId;
        request.Data.StartBreweryAddressKind = DeliveryAddressKind.Contact;

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()));

        var act = async () => await endpoint.HandleAsync(request, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    /// <summary>
    /// The regression this correction exists to prevent: a planner picks the brewery's
    /// contact address, saves, and it must not silently reload as the official one.
    /// Official and contact use distinct cities so a bug that persisted or read back the
    /// wrong address kind fails this assertion instead of coincidentally passing.
    /// </summary>
    [Fact]
    public async Task HandleAsync_StartBreweryAddressKindContact_PersistsAndReadsBackAsContact()
    {
        var brewery = BreweryBuilder.BuildEntity(
            name: "Svijany",
            officialAddress: AddressBuilder.BuildEntity(city: "Svijany", latitude: 50.5m, longitude: 15.0m),
            contactAddress: AddressBuilder.BuildEntity(city: "Turnov", latitude: 50.59m, longitude: 15.16m));
        brewery.Id = 7;
        var (shipment, request, dbContext) = Arrange(OutgoingShipmentState.Created, [brewery]);

        request.Data.StartPointKind = ShipmentStartPointKind.Brewery;
        request.Data.StartBreweryId = brewery.PublicId;
        request.Data.StartBreweryAddressKind = DeliveryAddressKind.Contact;

        var companyOptions = Options.Create(new CompanyOptions());
        var updateEndpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, companyOptions);

        await updateEndpoint.HandleAsync(request, CancellationToken.None);

        shipment.StartBreweryAddressKind.Should().Be(DeliveryAddressKind.Contact);

        // Read back through the detail endpoint against the same store — this is the
        // exact seam that would silently resolve back to Official if the persisted
        // kind were ignored on read.
        var detailEndpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object, companyOptions);

        await detailEndpoint.HandleAsync(new GetOutgoingShipmentDetailRequest { Id = shipment.PublicId }, CancellationToken.None);

        detailEndpoint.Response.StartBreweryAddressKind.Should().Be(DeliveryAddressKind.Contact);
        detailEndpoint.Response.StartPointAddress.Should().Contain("Turnov");
        detailEndpoint.Response.StartPointAddress.Should().NotContain("Svijany");
    }

    // Arrange(state, breweries) is shared with CompanyStopTests — see
    // OutgoingShipmentTestHelpers, imported above via `using static`.
}
