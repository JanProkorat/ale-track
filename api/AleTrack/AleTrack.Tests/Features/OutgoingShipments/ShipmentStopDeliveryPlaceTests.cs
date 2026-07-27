using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Orders.Queries.OutgoingShipmentsList;
using AleTrack.Features.OutgoingShipments.Commands.AcknowledgeAddressChanges;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

public sealed class ShipmentStopDeliveryPlaceTests
{
    private static ClientOrderShipmentDto Dto(DeliveryAddressKind kind, Guid? placeId) => new()
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
            Dto(DeliveryAddressKind.DeliveryPlace, null));

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
            Dto(DeliveryAddressKind.DeliveryPlace, Guid.NewGuid()));

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(DeliveryAddressKind.Official)]
    [InlineData(DeliveryAddressKind.Contact)]
    public async Task Validator_StandardKindWithPlaceId_Fails(DeliveryAddressKind kind)
    {
        var validator = new ClientOrderShipmentDtoValidator();

        var result = await validator.ValidateAsync(Dto(kind, Guid.NewGuid()));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(ClientOrderShipmentDto.ClientDeliveryPlaceId)
            && e.ErrorCode == ErrorCodes.ValidationError);
    }

    [Theory]
    [InlineData(DeliveryAddressKind.Official)]
    [InlineData(DeliveryAddressKind.Contact)]
    public async Task Validator_StandardKindWithoutPlaceId_Passes(DeliveryAddressKind kind)
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
            SelectedAddressKind = DeliveryAddressKind.Official
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
                        SelectedAddressKind = DeliveryAddressKind.Contact
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        await endpoint.HandleAsync(command, CancellationToken.None);

        var updatedStop = outgoingShipment.Stops.Single(s => s.ClientOrder!.PublicId == orderId);
        updatedStop.SelectedAddressKind.Should().Be(DeliveryAddressKind.Contact);
    }

    // Happy path for ShipmentStopDeliveryPlaceResolver: an existing stop that
    // switches to DeliveryPlace gets both SelectedAddressKind and the
    // resolved ClientDeliveryPlaceId written by the same update loop.
    [Fact]
    public async Task ProcessAsync_UpdateShipment_SwitchesExistingStopToDeliveryPlace_ResolvesFk()
    {
        var shipmentId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client);

        var placeId = Guid.NewGuid();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(publicId: placeId, client: client);

        var existingStop = new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Order,
            ClientOrder = order,
            Order = 1,
            SelectedAddressKind = DeliveryAddressKind.Official
        };

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created,
            stops: [existingStop]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [outgoingShipment],
            orders: [order],
            clientDeliveryPlaces: [place]
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
                        SelectedAddressKind = DeliveryAddressKind.DeliveryPlace,
                        ClientDeliveryPlaceId = placeId
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        await endpoint.HandleAsync(command, CancellationToken.None);

        var updatedStop = outgoingShipment.Stops.Single(s => s.ClientOrder!.PublicId == orderId);
        updatedStop.SelectedAddressKind.Should().Be(DeliveryAddressKind.DeliveryPlace);
        updatedStop.ClientDeliveryPlaceId.Should().Be(place.Id);
    }

    // Cross-client rejection: "the one way this schema can go wrong" per the
    // resolver's doc comment. The delivery place belongs to a different
    // client than the order it is requested on.
    [Fact]
    public async Task ProcessAsync_UpdateShipment_DeliveryPlaceFromDifferentClient_ThrowsBadRequest()
    {
        var shipmentId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var orderClient = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: orderClient);

        var otherClient = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var placeId = Guid.NewGuid();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(publicId: placeId, client: otherClient);

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [outgoingShipment],
            orders: [order],
            clientDeliveryPlaces: [place]
        );

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
                        SelectedAddressKind = DeliveryAddressKind.DeliveryPlace,
                        ClientDeliveryPlaceId = placeId
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    // Soft-deleted rejection: ClientDeliveryPlace has no global query filter,
    // so the resolver's own `!p.IsDeleted` check is the only thing standing
    // between a deleted place and a shipment stop.
    [Fact]
    public async Task ProcessAsync_UpdateShipment_SoftDeletedDeliveryPlace_ThrowsNotFound()
    {
        var shipmentId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client);

        var placeId = Guid.NewGuid();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(publicId: placeId, client: client, isDeleted: true);

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [outgoingShipment],
            orders: [order],
            clientDeliveryPlaces: [place]
        );

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
                        SelectedAddressKind = DeliveryAddressKind.DeliveryPlace,
                        ClientDeliveryPlaceId = placeId
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    // Lock-out regression: a shipment stop that already points at a place
    // gets resaved (e.g. flipping a nakládka checkbox, or advancing state)
    // *after* that place was soft-deleted from the client. Unlike the test
    // above — a fresh assignment onto a shipment with no stops — this stop
    // already referenced the place before the request, so the resolver must
    // not 404 it. See ShipmentStopDeliveryPlaceResolver's
    // alreadyReferencedPlaceIds parameter.
    [Fact]
    public async Task ProcessAsync_UpdateShipment_ResaveWithAlreadyReferencedSoftDeletedPlace_Succeeds()
    {
        var shipmentId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client);

        var placeId = Guid.NewGuid();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(publicId: placeId, client: client, isDeleted: true);

        var existingStop = new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Order,
            ClientOrder = order,
            Order = 1,
            SelectedAddressKind = DeliveryAddressKind.DeliveryPlace,
            ClientDeliveryPlace = place,
            ClientDeliveryPlaceId = place.Id
        };

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created,
            stops: [existingStop]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [outgoingShipment],
            orders: [order],
            clientDeliveryPlaces: [place]
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
                State = OutgoingShipmentState.Loaded,
                ClientOrderShipments =
                [
                    new ClientOrderShipmentDto
                    {
                        ClientOrderId = orderId,
                        Order = 1,
                        SelectedAddressKind = DeliveryAddressKind.DeliveryPlace,
                        ClientDeliveryPlaceId = placeId
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().NotThrowAsync();

        var updatedStop = outgoingShipment.Stops.Single(s => s.ClientOrder!.PublicId == orderId);
        updatedStop.SelectedAddressKind.Should().Be(DeliveryAddressKind.DeliveryPlace);
        updatedStop.ClientDeliveryPlaceId.Should().Be(place.Id);
    }

    // Missing-place 404: distinct from the soft-deleted case above — this ID
    // never existed at all.
    [Fact]
    public async Task ProcessAsync_UpdateShipment_UnknownDeliveryPlace_ThrowsNotFound()
    {
        var shipmentId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client);

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [outgoingShipment],
            orders: [order]
        );

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
                        SelectedAddressKind = DeliveryAddressKind.DeliveryPlace,
                        ClientDeliveryPlaceId = Guid.NewGuid()
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    // Guards the asymmetry that is the whole reason ClientDeliveryPlace has no
    // global query filter: the shipment detail must keep resolving a place
    // that has since been soft-deleted, so historical shipments still render
    // their delivery address instead of silently losing it.
    [Fact]
    public async Task ProcessAsync_ShipmentDetail_ResolvesSoftDeletedPlace()
    {
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(client: client);

        var place = ClientDeliveryPlaceBuilder.BuildEntity(client: client, name: "Zrušená hospoda", isDeleted: true);

        var stop = new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Order,
            ClientOrder = order,
            Order = 1,
            SelectedAddressKind = DeliveryAddressKind.DeliveryPlace,
            ClientDeliveryPlace = place
        };

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created,
            stops: [stop]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [order],
            outgoingShipments: [outgoingShipment],
            clientDeliveryPlaces: [place]
        );

        var request = new GetOutgoingShipmentDetailRequest { Id = shipmentId };
        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object);

        await endpoint.HandleAsync(request, CancellationToken.None);

        var returnedStop = endpoint.Response.Stops.Single();
        returnedStop.DeliveryPlace.Should().NotBeNull("a soft-deleted place must still render on shipments that already used it");
        returnedStop.DeliveryPlace!.Name.Should().Be("Zrušená hospoda");
    }

    // IsAddressOverridden is derived, never accepted from the request: a stop
    // whose requested kind and place match the order's own choice is not an
    // override.
    [Fact]
    public async Task ProcessAsync_UpdateShipment_StopMatchingTheOrderIsNotOverridden()
    {
        var shipmentId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity(), contactAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client, deliveryAddressKind: DeliveryAddressKind.Contact);

        var existingStop = new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Order,
            ClientOrder = order,
            Order = 1,
            SelectedAddressKind = DeliveryAddressKind.Official
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
                        SelectedAddressKind = DeliveryAddressKind.Contact
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        await endpoint.HandleAsync(command, CancellationToken.None);

        var updatedStop = outgoingShipment.Stops.Single(s => s.ClientOrder!.PublicId == orderId);
        updatedStop.IsAddressOverridden.Should().BeFalse();
    }

    // Mirror case: a stop asking for something other than what the order asks
    // for is an override, so an order edit will not silently rewrite it.
    [Fact]
    public async Task ProcessAsync_UpdateShipment_StopDifferingFromTheOrderIsOverridden()
    {
        var shipmentId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity(), contactAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client, deliveryAddressKind: DeliveryAddressKind.Official);

        var existingStop = new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Order,
            ClientOrder = order,
            Order = 1,
            SelectedAddressKind = DeliveryAddressKind.Official
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
                        SelectedAddressKind = DeliveryAddressKind.Contact
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        await endpoint.HandleAsync(command, CancellationToken.None);

        var updatedStop = outgoingShipment.Stops.Single(s => s.ClientOrder!.PublicId == orderId);
        updatedStop.IsAddressOverridden.Should().BeTrue();
    }

    // The planner has just been looking at the banner while editing, so
    // whatever it was announcing is considered acknowledged: any pending
    // AddressChangedAt stamp on the shipment's stops is cleared on update,
    // regardless of which stop was actually re-assigned.
    [Fact]
    public async Task ProcessAsync_UpdateShipment_ClearsPendingAddressChangeStamp()
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
            SelectedAddressKind = DeliveryAddressKind.Official,
            AddressChangedAt = DateTime.UtcNow
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
                        SelectedAddressKind = DeliveryAddressKind.Contact
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        await endpoint.HandleAsync(command, CancellationToken.None);

        var updatedStop = outgoingShipment.Stops.Single(s => s.ClientOrder!.PublicId == orderId);
        updatedStop.AddressChangedAt.Should().BeNull();
    }

    // The mirror-image assertion: the orders-list projection (which feeds the
    // shipment editor's picker) must exclude soft-deleted places, since a
    // removed place should no longer be offered as a destination.
    [Fact]
    public async Task ProcessAsync_OrdersForShipments_ExcludesSoftDeletedPlaces()
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var activePlace = ClientDeliveryPlaceBuilder.BuildEntity(client: client, name: "Aktivní místo");
        var deletedPlace = ClientDeliveryPlaceBuilder.BuildEntity(client: client, name: "Smazané místo", isDeleted: true);

        var order = OrderBuilder.BuildEntity(client: client);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [order],
            clientDeliveryPlaces: [activePlace, deletedPlace]
        );

        var request = new GetOrdersListForOutgoingShipmentsRequest();
        var endpoint = EndpointWithResponseBuilder<GetOrdersListForOutgoingShipmentsRequest, List<OutgoingShipmentOrderDto>, GetOrdersListForOutgoingShipmentsEndpoint>
            .Create(dbContext.Object);

        await endpoint.HandleAsync(request, CancellationToken.None);

        var returnedOrder = endpoint.Response.Single();
        returnedOrder.ClientDeliveryPlaces.Should().ContainSingle()
            .Which.Name.Should().Be("Aktivní místo");
    }

    [Fact]
    public async Task ProcessAsync_AcknowledgeAddressChanges_ClearsEveryStopOfThatShipmentOnly()
    {
        var target = new OutgoingShipment { PublicId = Guid.NewGuid(), State = OutgoingShipmentState.Created };
        var other = new OutgoingShipment { PublicId = Guid.NewGuid(), State = OutgoingShipmentState.Created };
        var stamped = new DateTime(2026, 7, 27, 9, 0, 0, DateTimeKind.Utc);

        target.Stops.Add(new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, AddressChangedAt = stamped });
        target.Stops.Add(new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Order, AddressChangedAt = stamped });
        other.Stops.Add(new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, AddressChangedAt = stamped });

        var db = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [target, other]);

        // Takes no body and reads the shipment from the route — see the
        // endpoint's remarks for why — so the test has to put it there.
        var endpoint = EndpointWithoutRequestBuilder<AcknowledgeAddressChangesEndpoint>.Create(db.Object);
        endpoint.HttpContext.Request.RouteValues["Id"] = target.PublicId.ToString();
        await endpoint.HandleAsync(CancellationToken.None);

        target.Stops.Should().OnlyContain(s => s.AddressChangedAt == null);
        other.Stops.Should().OnlyContain(s => s.AddressChangedAt == stamped);
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_AcknowledgeAddressChanges_UnknownShipment_Throws()
    {
        var db = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: []);

        var endpoint = EndpointWithoutRequestBuilder<AcknowledgeAddressChangesEndpoint>.Create(db.Object);
        endpoint.HttpContext.Request.RouteValues["Id"] = Guid.NewGuid().ToString();
        var act = () => endpoint.HandleAsync(CancellationToken.None);

        await act.Should().ThrowAsync<Exception>();
    }
}
