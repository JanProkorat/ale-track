using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.Create;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;

namespace AleTrack.Tests.Builders;

public static class OutgoingShipmentBuilder
{
    public static OutgoingShipment BuildEntity(
        Guid? publicId = null,
        DateTime? deliveryDate = null,
        OutgoingShipmentState state = OutgoingShipmentState.Created,
        Vehicle? vehicle = null,
        List<OutgoingShipmentDriver>? drivers = null,
        List<OutgoingShipmentStop>? stops = null)
    {
        return new OutgoingShipment
        {
            PublicId = publicId ?? Guid.NewGuid(),
            DeliveryDate = deliveryDate,
            State = state,
            Vehicle = vehicle,
            Drivers = drivers ?? [],
            Stops = stops ?? []
        };
    }

    public static CreateOutgoingShipmentDto BuildCreateDto(
        DateTime? deliveryDate = null,
        Guid? vehicleId = null,
        List<Guid>? driverIds = null,
        List<ClientOrderShipmentDto>? clientOrderShipments = null)
    {
        return new CreateOutgoingShipmentDto
        {
            DeliveryDate = deliveryDate,
            VehicleId = vehicleId,
            DriverIds = driverIds ?? [Guid.NewGuid()],
            ClientOrderShipments = clientOrderShipments ??
            [
                new ClientOrderShipmentDto
                {
                    ClientOrderId = Guid.NewGuid(),
                    Order = 1
                }
            ]
        };
    }

    public static UpdateOutgoingShipmentDto BuildUpdateDto(
        DateTime? deliveryDate = null,
        Guid? vehicleId = null,
        List<Guid>? driverIds = null,
        List<ClientOrderShipmentDto>? clientOrderShipments = null,
        OutgoingShipmentState state = OutgoingShipmentState.Loaded)
    {
        return new UpdateOutgoingShipmentDto
        {
            DeliveryDate = deliveryDate,
            VehicleId = vehicleId,
            DriverIds = driverIds ?? [Guid.NewGuid()],
            ClientOrderShipments = clientOrderShipments ??
            [
                new ClientOrderShipmentDto
                {
                    ClientOrderId = Guid.NewGuid(),
                    Order = 1
                }
            ],
            State = state
        };
    }
}
