using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Create;
using AleTrack.Features.Orders.Commands.Update;
using AleTrack.Features.Orders.Queries.Detail;
using AleTrack.Features.Orders.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;

namespace AleTrack.Tests.Features.Orders;

/// <summary>
/// An order carries any number of free-form notes, edited with the order the
/// same way returns are. DateCreated is server-owned.
/// </summary>
public sealed class OrderNotesTests
{
    [Fact]
    public async Task ProcessAsync_CreateOrder_PersistsNotesAndStampsThem()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());

        var productId = Guid.NewGuid();
        var product = ProductBuilder.BuildEntity(publicId: productId);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], products: [product]);

        var before = DateTime.UtcNow;
        var command = new CreateOrderRequest
        {
            Data = OrderBuilder.BuildCreateDto(
                clientId: clientId,
                orderItems: [new CreateOrderItemDto { ProductId = productId, Quantity = 5 }],
                notes:
                [
                    new OrderNoteDto { Text = "Dovézt dopoledne" },
                    new OrderNoteDto { Text = "Volat na vrátnici" }
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        var order = client.Orders.Should().ContainSingle().Subject;
        order.Notes.Should().HaveCount(2);
        order.Notes.Select(n => n.Text).Should().BeEquivalentTo(["Dovézt dopoledne", "Volat na vrátnici"]);
        order.Notes.Should().OnlyContain(n => n.DateCreated >= before);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdateOrder_AddsEditsAndDropsNotes()
    {
        var orderId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());

        var keptId = Guid.NewGuid();
        var created = new DateTime(2026, 3, 1, 8, 0, 0, DateTimeKind.Utc);
        var kept = new OrderNote { PublicId = keptId, Text = "Dovézt dopoledne", DateCreated = created };
        var dropped = new OrderNote { PublicId = Guid.NewGuid(), Text = "Zrušeno", DateCreated = created };

        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client, notes: [kept, dropped]);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var command = new UpdateOrderRequest
        {
            Id = orderId,
            Data = OrderBuilder.BuildUpdateDto(
                clientId: clientId,
                orderItems: [],
                notes:
                [
                    new OrderNoteDto { Id = keptId, Text = "Dovézt až odpoledne" },
                    new OrderNoteDto { Text = "Nový pokyn" }
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());
        await endpoint.HandleAsync(command, CancellationToken.None);

        order.Notes.Should().HaveCount(2);

        var edited = order.Notes.Should().ContainSingle(n => n.PublicId == keptId).Subject;
        edited.Text.Should().Be("Dovézt až odpoledne");
        edited.DateCreated.Should().Be(created, "editing a note does not re-date it");

        order.Notes.Should().Contain(n => n.Text == "Nový pokyn");
        order.Notes.Should().NotContain(n => n.Text == "Zrušeno");
    }

    [Fact]
    public async Task ProcessAsync_UpdateOrder_IgnoresAClientSuppliedDateCreated()
    {
        var orderId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var before = DateTime.UtcNow;
        var command = new UpdateOrderRequest
        {
            Id = orderId,
            Data = OrderBuilder.BuildUpdateDto(
                clientId: clientId,
                orderItems: [],
                notes: [new OrderNoteDto { Text = "Nový pokyn", DateCreated = new DateTime(1999, 1, 1, 0, 0, 0, DateTimeKind.Utc) }]
            )
        };

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), AppContextMockFactory.Anonymous());
        await endpoint.HandleAsync(command, CancellationToken.None);

        order.Notes.Should().ContainSingle().Which.DateCreated.Should().BeOnOrAfter(before);
    }

    [Fact]
    public async Task ProcessAsync_GetOrderDetail_ProjectsNotesOldestFirst()
    {
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());

        var newerId = Guid.NewGuid();
        var olderId = Guid.NewGuid();
        var order = OrderBuilder.BuildEntity(
            publicId: orderId,
            client: client,
            notes:
            [
                new OrderNote { PublicId = newerId, Text = "Druhá", DateCreated = new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc) },
                new OrderNote { PublicId = olderId, Text = "První", DateCreated = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc) }
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = orderId }, CancellationToken.None);

        endpoint.Response.Notes.Select(n => n.Text).Should().Equal("První", "Druhá");
        endpoint.Response.Notes[0].Id.Should().Be(olderId);
    }

    [Fact]
    public void OrderNoteValidator_RejectsBlankAndOverlongText()
    {
        var validator = new OrderNoteDtoValidator();

        validator.Validate(new OrderNoteDto { Text = "" }).IsValid.Should().BeFalse();
        validator.Validate(new OrderNoteDto { Text = new string('x', 1001) }).IsValid.Should().BeFalse();
        validator.Validate(new OrderNoteDto { Text = "Dovézt dopoledne" }).IsValid.Should().BeTrue();
    }
}
