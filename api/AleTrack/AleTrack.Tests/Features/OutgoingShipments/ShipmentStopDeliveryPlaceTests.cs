using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

public sealed class ShipmentStopDeliveryPlaceTests
{
    private static ClientOrderShipmentDto Dto(OutgoingShipmentStopAddressKind kind, Guid? placeId) => new()
    {
        ClientOrderId = Guid.NewGuid(),
        Order = 1,
        SelectedAddressKind = kind,
        ClientDeliveryPlaceId = placeId
    };

    [Fact]
    public async Task Validator_DeliveryPlaceKindWithoutId_Fails()
    {
        var validator = new ClientOrderShipmentDtoValidator();

        var result = await validator.ValidateAsync(
            Dto(OutgoingShipmentStopAddressKind.DeliveryPlace, null));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(ClientOrderShipmentDto.ClientDeliveryPlaceId)
            && e.ErrorCode == ErrorCodes.ValidationNotNullError);
    }

    [Fact]
    public async Task Validator_DeliveryPlaceKindWithId_Passes()
    {
        var validator = new ClientOrderShipmentDtoValidator();

        var result = await validator.ValidateAsync(
            Dto(OutgoingShipmentStopAddressKind.DeliveryPlace, Guid.NewGuid()));

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(OutgoingShipmentStopAddressKind.Official)]
    [InlineData(OutgoingShipmentStopAddressKind.Contact)]
    public async Task Validator_StandardKindWithPlaceId_Fails(OutgoingShipmentStopAddressKind kind)
    {
        var validator = new ClientOrderShipmentDtoValidator();

        var result = await validator.ValidateAsync(Dto(kind, Guid.NewGuid()));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(ClientOrderShipmentDto.ClientDeliveryPlaceId));
    }

    [Theory]
    [InlineData(OutgoingShipmentStopAddressKind.Official)]
    [InlineData(OutgoingShipmentStopAddressKind.Contact)]
    public async Task Validator_StandardKindWithoutPlaceId_Passes(OutgoingShipmentStopAddressKind kind)
    {
        var validator = new ClientOrderShipmentDtoValidator();

        var result = await validator.ValidateAsync(Dto(kind, null));

        result.IsValid.Should().BeTrue();
    }

    // Regression: before this feature the update endpoint wrote
    // SelectedAddressKind only for newly added stops, so changing it on an
    // already-linked stop silently did nothing.
    [Fact]
    public async Task ProcessAsync_UpdateShipment_ChangesAddressKindOnExistingStop()
    {
        var shipmentId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client);

        var existingStop = new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Order,
            ClientOrder = order,
            Order = 1,
            SelectedAddressKind = OutgoingShipmentStopAddressKind.Official
        };

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created,
            stops: [existingStop]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [outgoingShipment],
            orders: [order]
        );
        dbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var command = new UpdateOutgoingShipmentRequest
        {
            Id = shipmentId,
            Data = new UpdateOutgoingShipmentDto
            {
                Name = "vyvoz",
                DeliveryDate = DateTime.UtcNow.AddDays(1),
                DriverIds = [],
                State = OutgoingShipmentState.Created,
                ClientOrderShipments =
                [
                    new ClientOrderShipmentDto
                    {
                        ClientOrderId = orderId,
                        Order = 1,
                        SelectedAddressKind = OutgoingShipmentStopAddressKind.Contact
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        await endpoint.HandleAsync(command, CancellationToken.None);

        var updatedStop = outgoingShipment.Stops.Single(s => s.ClientOrder!.PublicId == orderId);
        updatedStop.SelectedAddressKind.Should().Be(OutgoingShipmentStopAddressKind.Contact);
    }
}
