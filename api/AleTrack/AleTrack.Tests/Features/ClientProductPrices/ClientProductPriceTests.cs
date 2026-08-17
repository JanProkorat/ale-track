using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.ClientProductPrices;
using AleTrack.Features.ClientProductPrices.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.ClientProductPrices;

public sealed class ClientProductPriceTests
{
    [Fact]
    public async Task HandleAsync_ClientWithPrices_ReturnsThemWithCatalogPriceBeside()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        client.Id = 7;
        var brewery = new Brewery { Id = 3, PublicId = Guid.NewGuid(), Name = "Pivovar Frýdlant" };
        var product = new Product
        {
            Id = 11, PublicId = Guid.NewGuid(), BreweryId = 3, Brewery = brewery,
            Name = "Albrecht 12°", Kind = ProductKind.Keg, PackageSize = 30,
            PriceWithVat = 1290m, IsDeleted = false
        };
        var price = new ClientProductPrice
        {
            Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
            ProductId = 11, Product = product, PriceWithVat = 1190m,
            SetOn = new DateOnly(2026, 3, 2)
        };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], breweries: [brewery], products: [product],
            clientProductPrices: [price]);

        var endpoint = EndpointWithResponseBuilder<GetClientProductPricesRequest,
            List<ClientProductPriceDto>, GetClientProductPricesEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new GetClientProductPricesRequest { ClientId = clientId }, CancellationToken.None);

        var result = endpoint.Response;
        result.Should().HaveCount(1);
        result[0].PriceWithVat.Should().Be(1190m);
        result[0].ListPriceWithVat.Should().Be(1290m);
        result[0].ProductName.Should().Be("Albrecht 12°");
        result[0].BreweryName.Should().Be("Pivovar Frýdlant");
        result[0].SetOn.Should().Be(new DateOnly(2026, 3, 2));
    }

    [Fact]
    public async Task HandleAsync_PriceOnDeletedProduct_IsOmitted()
    {
        // The row survives — product_id is Restrict and nothing benefits from deleting it —
        // but a retired product must not show up in the Ceník tab.
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        client.Id = 7;
        var brewery = new Brewery { Id = 3, PublicId = Guid.NewGuid(), Name = "B" };
        var product = new Product
        {
            Id = 11, PublicId = Guid.NewGuid(), BreweryId = 3, Brewery = brewery,
            Name = "Retired", Kind = ProductKind.Keg, PriceWithVat = 100m, IsDeleted = true
        };
        var price = new ClientProductPrice
        {
            Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
            ProductId = 11, Product = product, PriceWithVat = 90m, SetOn = new DateOnly(2026, 1, 1)
        };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], breweries: [brewery], products: [product], clientProductPrices: [price]);

        var endpoint = EndpointWithResponseBuilder<GetClientProductPricesRequest,
            List<ClientProductPriceDto>, GetClientProductPricesEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new GetClientProductPricesRequest { ClientId = clientId }, CancellationToken.None);

        endpoint.Response.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_UnknownClient_Throws404()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: []);

        var endpoint = EndpointWithResponseBuilder<GetClientProductPricesRequest,
            List<ClientProductPriceDto>, GetClientProductPricesEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(
            new GetClientProductPricesRequest { ClientId = Guid.NewGuid() }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>();
    }
}
