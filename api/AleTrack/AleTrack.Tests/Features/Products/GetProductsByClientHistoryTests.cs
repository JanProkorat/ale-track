using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Queries.ClientHistory;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

public sealed class GetProductsByClientHistoryTests
{
    [Fact]
    public async Task HandleAsync_ReturnsProductsOrderedByOrderFrequency()
    {
        // Arrange
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var brewery = BreweryBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            officialAddress: AddressBuilder.BuildEntity()
        );

        var product1 = ProductBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            name: "Product A"
        );
        product1.Id = 1;
        product1.Brewery = brewery;

        var product2 = ProductBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            name: "Product B"
        );
        product2.Id = 2;
        product2.Brewery = brewery;

        var product3 = ProductBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            name: "Product C"
        );
        product3.Id = 3;
        product3.Brewery = brewery;

        // Create orders with different product frequencies
        // Product 2 ordered 3 times, Product 1 ordered 2 times, Product 3 ordered 1 time
        var order1 = new Order
        {
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = OrderState.Finished,
            CreatedDate = DateTime.UtcNow.AddDays(-10)
        };

        var order2 = new Order
        {
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = OrderState.Finished,
            CreatedDate = DateTime.UtcNow.AddDays(-5)
        };

        var order3 = new Order
        {
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = OrderState.Finished,
            CreatedDate = DateTime.UtcNow.AddDays(-2)
        };

        var orderItem1 = new OrderItem
        {
            ProductId = product1.Id,
            Product = product1,
            OrderId = order1.Id,
            Order = order1,
            Quantity = 10
        };

        var orderItem2 = new OrderItem
        {
            ProductId = product2.Id,
            Product = product2,
            OrderId = order1.Id,
            Order = order1,
            Quantity = 5
        };

        var orderItem3 = new OrderItem
        {
            ProductId = product1.Id,
            Product = product1,
            OrderId = order2.Id,
            Order = order2,
            Quantity = 8
        };

        var orderItem4 = new OrderItem
        {
            ProductId = product2.Id,
            Product = product2,
            OrderId = order2.Id,
            Order = order2,
            Quantity = 6
        };

        var orderItem5 = new OrderItem
        {
            ProductId = product2.Id,
            Product = product2,
            OrderId = order3.Id,
            Order = order3,
            Quantity = 3
        };

        var orderItem6 = new OrderItem
        {
            ProductId = product3.Id,
            Product = product3,
            OrderId = order3.Id,
            Order = order3,
            Quantity = 2
        };

        order1.OrderItems = [orderItem1, orderItem2];
        order2.OrderItems = [orderItem3, orderItem4];
        order3.OrderItems = [orderItem5, orderItem6];

        client.Orders = [order1, order2, order3];

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            breweries: [brewery],
            products: [product1, product2, product3],
            orders: [order1, order2, order3],
            orderItems: [orderItem1, orderItem2, orderItem3, orderItem4, orderItem5, orderItem6]
        );

        var request = new GetProductsByClientHistoryRequest
        {
            ClientId = clientId
        };

        var endpoint = EndpointWithResponseBuilder<GetProductsByClientHistoryRequest,
            GroupedProductHistoryDto, GetProductsByClientHistoryEndpoint>
            .Create(dbContext.Object);

        // Act
        await endpoint.HandleAsync(request, CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.Should().NotBeNull();
        response.Recent.Should().HaveCount(3);

        // Product 2 should be first (ordered 3 times)
        response.Recent[0].Name.Should().Be("Product B");
        response.Recent[0].Id.Should().Be(product2.PublicId);

        // Product 1 should be second (ordered 2 times)
        response.Recent[1].Name.Should().Be("Product A");
        response.Recent[1].Id.Should().Be(product1.PublicId);

        // Product 3 should be last (ordered 1 time)
        response.Recent[2].Name.Should().Be("Product C");
        response.Recent[2].Id.Should().Be(product3.PublicId);
    }

    [Fact]
    public async Task HandleAsync_ClientWithNoOrders_ReturnsAllProductsOrderedByName()
    {
        // Arrange
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var brewery = BreweryBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            officialAddress: AddressBuilder.BuildEntity()
        );

        var product1 = ProductBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            name: "Zulu Beer"
        );
        product1.Brewery = brewery;

        var product2 = ProductBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            name: "Alpha Beer"
        );
        product2.Brewery = brewery;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            breweries: [brewery],
            products: [product1, product2]
        );

        var request = new GetProductsByClientHistoryRequest
        {
            ClientId = clientId
        };

        var endpoint = EndpointWithResponseBuilder<GetProductsByClientHistoryRequest,
            GroupedProductHistoryDto, GetProductsByClientHistoryEndpoint>
            .Create(dbContext.Object);

        // Act
        await endpoint.HandleAsync(request, CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.Should().NotBeNull();

        // For client with no orders, Recent should be empty
        response.Recent.Should().BeEmpty();

        // All products should be present in Breweries groups, ordered by name
        var allProducts = response.Breweries
            .SelectMany(b => b.Kinds)
            .SelectMany(k => k.PackageSizes)
            .SelectMany(ps => ps.Items)
            .ToList();

        allProducts.Should().HaveCount(2);
        allProducts[0].Name.Should().Be("Alpha Beer");
        allProducts[1].Name.Should().Be("Zulu Beer");
    }

    [Fact]
    public async Task HandleAsync_WithFilterParameters_AppliesFiltersCorrectly()
    {
        // Arrange
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var brewery = BreweryBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            officialAddress: AddressBuilder.BuildEntity()
        );

        var product1 = ProductBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            name: "Product A",
            kind: ProductKind.Bottle
        );
        product1.Id = 1;
        product1.Brewery = brewery;

        var product2 = ProductBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            name: "Product B",
            kind: ProductKind.Keg
        );
        product2.Id = 2;
        product2.Brewery = brewery;

        var order1 = new Order
        {
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = OrderState.Finished,
            CreatedDate = DateTime.UtcNow.AddDays(-10)
        };

        var orderItem1 = new OrderItem
        {
            ProductId = product1.Id,
            Product = product1,
            OrderId = order1.Id,
            Order = order1,
            Quantity = 10
        };

        var orderItem2 = new OrderItem
        {
            ProductId = product2.Id,
            Product = product2,
            OrderId = order1.Id,
            Order = order1,
            Quantity = 5
        };

        order1.OrderItems = [orderItem1, orderItem2];
        client.Orders = [order1];

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            breweries: [brewery],
            products: [product1, product2],
            orders: [order1],
            orderItems: [orderItem1, orderItem2]
        );

        var request = new GetProductsByClientHistoryRequest
        {
            ClientId = clientId,
            Parameters = new Dictionary<string, string>
            {
                { "Kind", $"eq:{(int)ProductKind.Bottle}" }
            }
        };

        var endpoint = EndpointWithResponseBuilder<GetProductsByClientHistoryRequest,
            GroupedProductHistoryDto, GetProductsByClientHistoryEndpoint>
            .Create(dbContext.Object);

        // Act
        await endpoint.HandleAsync(request, CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.Should().NotBeNull();

        // Only bottle products should appear in Recent (and Breweries should not contain filtered-out products)
        response.Recent.Should().HaveCount(1);
        response.Recent[0].Name.Should().Be("Product A");
        response.Recent[0].Kind.Should().Be(ProductKind.Bottle);

        var allProductsInBreweries = response.Breweries
            .SelectMany(b => b.Kinds)
            .SelectMany(k => k.PackageSizes)
            .SelectMany(ps => ps.Items)
            .ToList();

        allProductsInBreweries.Should().OnlyContain(p => p.Kind == ProductKind.Bottle);
    }
}
