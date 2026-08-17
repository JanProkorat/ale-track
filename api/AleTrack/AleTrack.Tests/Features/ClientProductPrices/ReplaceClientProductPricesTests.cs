using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ClientProductPrices.Commands.Replace;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using FluentValidation.TestHelper;
using Moq;

namespace AleTrack.Tests.Features.ClientProductPrices;

public sealed class ReplaceClientProductPricesTests
{
    [Fact]
    public async Task HandleAsync_Replace_UpsertsPresentAndDeletesAbsent()
    {
        var clientId = Guid.NewGuid();
        var keptProductId = Guid.NewGuid();
        var droppedProductId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        client.Id = 7;
        var kept = new Product { Id = 11, PublicId = keptProductId, Name = "Kept", PriceWithVat = 1290m };
        var dropped = new Product { Id = 12, PublicId = droppedProductId, Name = "Dropped", PriceWithVat = 990m };
        var keptPrice = new ClientProductPrice
        {
            Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
            ProductId = 11, Product = kept, PriceWithVat = 1190m, SetOn = new DateOnly(2020, 1, 1)
        };
        var droppedPrice = new ClientProductPrice
        {
            Id = 2, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
            ProductId = 12, Product = dropped, PriceWithVat = 900m, SetOn = new DateOnly(2020, 1, 1)
        };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [kept, dropped], clientProductPrices: [keptPrice, droppedPrice]);

        var endpoint = EndpointBuilder<ReplaceClientProductPricesRequest, ReplaceClientProductPricesEndpoint>
            .Create(dbContext.Object, TimeProvider.System);
        await endpoint.HandleAsync(new ReplaceClientProductPricesRequest
        {
            ClientId = clientId,
            Data = [new ClientProductPriceEntryDto { ProductId = keptProductId, PriceWithVat = 1226m }]
        }, CancellationToken.None);

        keptPrice.PriceWithVat.Should().Be(1226m);
        keptPrice.SetOn.Should().NotBe(new DateOnly(2020, 1, 1));
        dbContext.Verify(e => e.ClientProductPrices.Remove(droppedPrice), Times.Once);
        dbContext.Verify(e => e.ClientProductPrices.Add(It.IsAny<ClientProductPrice>()), Times.Never);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_UnchangedPrice_LeavesPriceAndSetOnUntouched()
    {
        // The guard that skips a restamp when the number did not move is the other load-bearing
        // half of replace semantics: a no-op save must not rewrite "when was this price decided."
        var clientId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        client.Id = 7;
        var product = new Product { Id = 11, PublicId = productId, Name = "P", PriceWithVat = 1290m };
        var seededSetOn = new DateOnly(2020, 1, 1);
        var unchangedPrice = new ClientProductPrice
        {
            Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
            ProductId = 11, Product = product, PriceWithVat = 1190m, SetOn = seededSetOn
        };
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [product], clientProductPrices: [unchangedPrice]);

        var endpoint = EndpointBuilder<ReplaceClientProductPricesRequest, ReplaceClientProductPricesEndpoint>
            .Create(dbContext.Object, TimeProvider.System);
        await endpoint.HandleAsync(new ReplaceClientProductPricesRequest
        {
            ClientId = clientId,
            Data = [new ClientProductPriceEntryDto { ProductId = productId, PriceWithVat = 1190m }]
        }, CancellationToken.None);

        unchangedPrice.PriceWithVat.Should().Be(1190m);
        unchangedPrice.SetOn.Should().Be(seededSetOn);
        dbContext.Verify(e => e.ClientProductPrices.Remove(unchangedPrice), Times.Never);
        dbContext.Verify(e => e.ClientProductPrices.Add(It.IsAny<ClientProductPrice>()), Times.Never);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_EmptyList_RevertsTheClientToCatalogPrices()
    {
        // Vyprázdnit vše then save. The symmetry with one click creating a whole
        // catalog's worth of prices is the point.
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        client.Id = 7;
        var product = new Product { Id = 11, PublicId = Guid.NewGuid(), Name = "P", PriceWithVat = 1290m };
        var price = new ClientProductPrice
        {
            Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
            ProductId = 11, Product = product, PriceWithVat = 1190m, SetOn = new DateOnly(2026, 1, 1)
        };
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [product], clientProductPrices: [price]);

        var endpoint = EndpointBuilder<ReplaceClientProductPricesRequest, ReplaceClientProductPricesEndpoint>
            .Create(dbContext.Object, TimeProvider.System);
        await endpoint.HandleAsync(new ReplaceClientProductPricesRequest
        {
            ClientId = clientId,
            Data = []
        }, CancellationToken.None);

        dbContext.Verify(e => e.ClientProductPrices.Remove(price), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_UnknownProductInBody_Throws404()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        client.Id = 7;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [], clientProductPrices: []);

        var endpoint = EndpointBuilder<ReplaceClientProductPricesRequest, ReplaceClientProductPricesEndpoint>
            .Create(dbContext.Object, TimeProvider.System);

        var act = async () => await endpoint.HandleAsync(new ReplaceClientProductPricesRequest
        {
            ClientId = clientId,
            Data = [new ClientProductPriceEntryDto { ProductId = Guid.NewGuid(), PriceWithVat = 100m }]
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>();
    }

    [Fact]
    public void Validate_DuplicateProduct_FailsWithCorrectCode()
    {
        var productId = Guid.NewGuid();
        var result = new ReplaceClientProductPricesValidator().TestValidate(
            new ReplaceClientProductPricesRequest
            {
                ClientId = Guid.NewGuid(),
                Data =
                [
                    new ClientProductPriceEntryDto { ProductId = productId, PriceWithVat = 100m },
                    new ClientProductPriceEntryDto { ProductId = productId, PriceWithVat = 200m }
                ]
            });

        result.ShouldHaveValidationErrorFor(x => x.Data)
            .WithErrorCode(ErrorCodes.ClientProductPriceDuplicateProduct);
    }

    [Fact]
    public void Validate_NonPositivePriceInBody_FailsWithCorrectCode()
    {
        var result = new ReplaceClientProductPricesValidator().TestValidate(
            new ReplaceClientProductPricesRequest
            {
                ClientId = Guid.NewGuid(),
                Data = [new ClientProductPriceEntryDto { ProductId = Guid.NewGuid(), PriceWithVat = -5m }]
            });

        result.ShouldHaveValidationErrorFor("Data[0].PriceWithVat")
            .WithErrorCode(ErrorCodes.ClientProductPriceMustBePositive);
    }
}
