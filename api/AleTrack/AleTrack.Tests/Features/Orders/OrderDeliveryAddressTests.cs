using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ClientDeliveryPlaces;
using AleTrack.Features.Orders.Commands.Create;
using AleTrack.Features.Orders.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Orders;

public sealed class OrderDeliveryAddressTests
{
    // A new order delivers to the billing address unless told otherwise —
    // the enum's zero value must therefore be Official, because that is also
    // what the column default and the migration backfill rely on.
    [Fact]
    public void NewOrder_DefaultsToOfficialAddressAndNoPlace()
    {
        var order = OrderBuilder.BuildEntity();

        order.DeliveryAddressKind.Should().Be(DeliveryAddressKind.Official);
        order.ClientDeliveryPlaceId.Should().BeNull();
    }

    [Fact]
    public void NewShipmentStop_IsNotOverriddenAndHasNoPendingChange()
    {
        var stop = new OutgoingShipmentStop { Kind = OutgoingShipmentStopKind.Order, Order = 1 };

        stop.IsAddressOverridden.Should().BeFalse();
        stop.AddressChangedAt.Should().BeNull();
    }

    [Fact]
    public async Task ResolveForClient_PlaceOfAnotherClient_Throws()
    {
        var ownerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var owner = ClientBuilder.BuildEntity(publicId: ownerId);
        var other = ClientBuilder.BuildEntity(publicId: otherId);
        var place = ClientDeliveryPlaceBuilder.BuildEntity(client: other);
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [owner, other], clientDeliveryPlaces: [place]);

        var act = () => ClientDeliveryPlaceResolver.ResolveForClientAsync(
            db.Object, ownerId, place.PublicId, null, CancellationToken.None);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task ResolveForClient_SoftDeletedPlace_ThrowsOnNewAssignment()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        var place = ClientDeliveryPlaceBuilder.BuildEntity(client: client, isDeleted: true);
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], clientDeliveryPlaces: [place]);

        var act = () => ClientDeliveryPlaceResolver.ResolveForClientAsync(
            db.Object, clientId, place.PublicId, null, CancellationToken.None);

        await act.Should().ThrowAsync<Exception>();
    }

    // The read model deliberately keeps rendering a soft-deleted place, so an
    // entity already pointing at one has to stay saveable — otherwise editing
    // anything else on it would 404 forever.
    [Fact]
    public async Task ResolveForClient_SoftDeletedPlaceAlreadyReferenced_Resolves()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        var place = ClientDeliveryPlaceBuilder.BuildEntity(client: client, isDeleted: true);
        place.Id = 42;
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], clientDeliveryPlaces: [place]);

        var result = await ClientDeliveryPlaceResolver.ResolveForClientAsync(
            db.Object, clientId, place.PublicId, allowedDeletedId: 42, CancellationToken.None);

        result.Should().Be(42);
    }

    [Fact]
    public async Task ResolveForClient_NullPlaceId_ReturnsNull()
    {
        var db = AleTrackDbContextMockFactory.CreateMock();

        var result = await ClientDeliveryPlaceResolver.ResolveForClientAsync(
            db.Object, Guid.NewGuid(), null, null, CancellationToken.None);

        result.Should().BeNull();
    }

    [Fact]
    public async Task CreateValidator_DeliveryPlaceKindWithoutId_Fails()
    {
        var dto = OrderBuilder.BuildCreateDto();
        dto.DeliveryAddressKind = DeliveryAddressKind.DeliveryPlace;
        dto.ClientDeliveryPlaceId = null;

        var result = await new CreateOrderDtoValidator().ValidateAsync(dto);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(CreateOrderDto.ClientDeliveryPlaceId)
            && e.ErrorCode == ErrorCodes.ValidationNotNullError);
    }

    [Theory]
    [InlineData(DeliveryAddressKind.Official)]
    [InlineData(DeliveryAddressKind.Contact)]
    public async Task CreateValidator_StandardKindWithPlaceId_Fails(DeliveryAddressKind kind)
    {
        var dto = OrderBuilder.BuildCreateDto();
        dto.DeliveryAddressKind = kind;
        dto.ClientDeliveryPlaceId = Guid.NewGuid();

        var result = await new CreateOrderDtoValidator().ValidateAsync(dto);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(CreateOrderDto.ClientDeliveryPlaceId)
            && e.ErrorCode == ErrorCodes.ValidationError);
    }

    [Fact]
    public async Task CreateValidator_DeliveryPlaceKindWithId_Passes()
    {
        var dto = OrderBuilder.BuildCreateDto();
        dto.DeliveryAddressKind = DeliveryAddressKind.DeliveryPlace;
        dto.ClientDeliveryPlaceId = Guid.NewGuid();

        var result = await new CreateOrderDtoValidator().ValidateAsync(dto);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateValidator_DeliveryPlaceKindWithoutId_Fails()
    {
        var dto = OrderBuilder.BuildUpdateDto();
        dto.DeliveryAddressKind = DeliveryAddressKind.DeliveryPlace;
        dto.ClientDeliveryPlaceId = null;

        var result = await new UpdateOrderDtoValidator().ValidateAsync(dto);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(UpdateOrderDto.ClientDeliveryPlaceId)
            && e.ErrorCode == ErrorCodes.ValidationNotNullError);
    }

    [Fact]
    public async Task UpdateValidator_StandardKindWithPlaceId_Fails()
    {
        var dto = OrderBuilder.BuildUpdateDto();
        dto.DeliveryAddressKind = DeliveryAddressKind.Official;
        dto.ClientDeliveryPlaceId = Guid.NewGuid();

        var result = await new UpdateOrderDtoValidator().ValidateAsync(dto);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(UpdateOrderDto.ClientDeliveryPlaceId)
            && e.ErrorCode == ErrorCodes.ValidationError);
    }

    [Fact]
    public async Task CreateOrder_WithDeliveryPlace_PersistsKindAndPlace()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());
        var place = ClientDeliveryPlaceBuilder.BuildEntity(client: client);
        place.Id = 7;
        var product = ProductBuilder.BuildEntity();
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [product], clientDeliveryPlaces: [place]);

        var dto = OrderBuilder.BuildCreateDto(
            clientId: clientId,
            orderItems: [new CreateOrderItemDto { ProductId = product.PublicId, Quantity = 1 }]);
        dto.DeliveryAddressKind = DeliveryAddressKind.DeliveryPlace;
        dto.ClientDeliveryPlaceId = place.PublicId;

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(db.Object);
        await endpoint.HandleAsync(new CreateOrderRequest { Data = dto }, CancellationToken.None);

        var saved = client.Orders.Single();
        saved.DeliveryAddressKind.Should().Be(DeliveryAddressKind.DeliveryPlace);
        saved.ClientDeliveryPlaceId.Should().Be(7);
    }

    [Fact]
    public async Task CreateOrder_ContactKindWithoutContactAddress_Throws()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId, officialAddress: AddressBuilder.BuildEntity());
        client.ContactAddress = null;
        var product = ProductBuilder.BuildEntity();
        var db = AleTrackDbContextMockFactory.CreateMock(clients: [client], products: [product]);

        var dto = OrderBuilder.BuildCreateDto(
            clientId: clientId,
            orderItems: [new CreateOrderItemDto { ProductId = product.PublicId, Quantity = 1 }]);
        dto.DeliveryAddressKind = DeliveryAddressKind.Contact;

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(db.Object);
        var act = () => endpoint.HandleAsync(new CreateOrderRequest { Data = dto }, CancellationToken.None);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task CreateOrder_PlaceOfAnotherClient_Throws()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());
        var stranger = ClientBuilder.BuildEntity();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(client: stranger);
        var product = ProductBuilder.BuildEntity();
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client, stranger], products: [product], clientDeliveryPlaces: [place]);

        var dto = OrderBuilder.BuildCreateDto(
            clientId: clientId,
            orderItems: [new CreateOrderItemDto { ProductId = product.PublicId, Quantity = 1 }]);
        dto.DeliveryAddressKind = DeliveryAddressKind.DeliveryPlace;
        dto.ClientDeliveryPlaceId = place.PublicId;

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(db.Object);
        var act = () => endpoint.HandleAsync(new CreateOrderRequest { Data = dto }, CancellationToken.None);

        await act.Should().ThrowAsync<Exception>();
    }
}
