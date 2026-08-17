using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ClientProductPrices;
using AleTrack.Features.ClientProductPrices.Commands;
using AleTrack.Features.ClientProductPrices.Commands.Delete;
using AleTrack.Features.ClientProductPrices.Commands.Save;
using AleTrack.Features.ClientProductPrices.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using FluentValidation.TestHelper;
using Moq;

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

    [Fact]
    public async Task HandleAsync_SaveNewPrice_CreatesRowStampedToday()
    {
        var clientId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        client.Id = 7;
        var product = new Product { Id = 11, PublicId = productId, Name = "P", PriceWithVat = 1290m };
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [product], clientProductPrices: []);

        var endpoint = EndpointBuilder<SaveClientProductPriceRequest, SaveClientProductPriceEndpoint>
            .Create(dbContext.Object, TimeProvider.System);
        await endpoint.HandleAsync(new SaveClientProductPriceRequest
        {
            ClientId = clientId,
            ProductId = productId,
            Data = new SaveClientProductPriceDto { PriceWithVat = 1190m }
        }, CancellationToken.None);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_SaveExistingPrice_OverwritesItAndRestampsSetOn()
    {
        var clientId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        client.Id = 7;
        var product = new Product { Id = 11, PublicId = productId, Name = "P", PriceWithVat = 1290m };
        var existing = new ClientProductPrice
        {
            Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
            ProductId = 11, Product = product, PriceWithVat = 1190m,
            SetOn = new DateOnly(2020, 1, 1)
        };
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [product], clientProductPrices: [existing]);

        var endpoint = EndpointBuilder<SaveClientProductPriceRequest, SaveClientProductPriceEndpoint>
            .Create(dbContext.Object, TimeProvider.System);
        await endpoint.HandleAsync(new SaveClientProductPriceRequest
        {
            ClientId = clientId,
            ProductId = productId,
            Data = new SaveClientProductPriceDto { PriceWithVat = 1150m }
        }, CancellationToken.None);

        existing.PriceWithVat.Should().Be(1150m);
        existing.SetOn.Should().NotBe(new DateOnly(2020, 1, 1));
    }

    [Fact]
    public async Task HandleAsync_SaveForUnknownProduct_Throws404()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        client.Id = 7;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [], clientProductPrices: []);

        var endpoint = EndpointBuilder<SaveClientProductPriceRequest, SaveClientProductPriceEndpoint>
            .Create(dbContext.Object, TimeProvider.System);

        var act = async () => await endpoint.HandleAsync(new SaveClientProductPriceRequest
        {
            ClientId = clientId,
            ProductId = Guid.NewGuid(),
            Data = new SaveClientProductPriceDto { PriceWithVat = 1m }
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>();
    }

    [Fact]
    public async Task HandleAsync_DeletePrice_RemovesTheRow()
    {
        var clientId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        client.Id = 7;
        var product = new Product { Id = 11, PublicId = productId, Name = "P", PriceWithVat = 1290m };
        var existing = new ClientProductPrice
        {
            Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
            ProductId = 11, Product = product, PriceWithVat = 1190m, SetOn = new DateOnly(2026, 1, 1)
        };
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [product], clientProductPrices: [existing]);

        var endpoint = EndpointBuilder<DeleteClientProductPriceRequest, DeleteClientProductPriceEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new DeleteClientProductPriceRequest
        {
            ClientId = clientId,
            ProductId = productId
        }, CancellationToken.None);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void Validate_NonPositivePrice_FailsWithCorrectCode()
    {
        var result = new SaveClientProductPriceValidator().TestValidate(new SaveClientProductPriceRequest
        {
            ClientId = Guid.NewGuid(),
            ProductId = Guid.NewGuid(),
            Data = new SaveClientProductPriceDto { PriceWithVat = 0m }
        });

        result.ShouldHaveValidationErrorFor(x => x.Data.PriceWithVat)
            .WithErrorCode(ErrorCodes.ClientProductPriceMustBePositive);
    }
}
