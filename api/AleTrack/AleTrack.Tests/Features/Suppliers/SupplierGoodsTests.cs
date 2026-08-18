using AleTrack.Common.Models;
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.Suppliers.Commands.Goods;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Suppliers;

public sealed class CreateSupplierGoodTests
{
    [Fact]
    public async Task ProcessAsync_CreateGood_AddsItWithEveryChargeKind()
    {
        var supplierId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var command = new CreateSupplierGoodRequest
        {
            Id = supplierId,
            Data = SupplierBuilder.BuildGoodUpsertDto(
                name: "CO₂ láhev",
                size: "10 kg",
                description: "Potravinářský CO₂ E290",
                prices:
                [
                    SupplierBuilder.BuildPriceUpsertDto(SupplierChargeKind.Fill, 450m, 372m),
                    SupplierBuilder.BuildPriceUpsertDto(SupplierChargeKind.Purchase, 2900m, 2397m),
                    SupplierBuilder.BuildPriceUpsertDto(SupplierChargeKind.Deposit, 1200m, note: "vratná")
                ])
        };

        var endpoint = EndpointBuilder<CreateSupplierGoodRequest, CreateSupplierGoodEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        supplier.Goods.Should().HaveCount(1);
        var good = supplier.Goods.Single();
        good.Name.Should().Be("CO₂ láhev");
        good.Size.Should().Be("10 kg");
        good.Prices.Should().HaveCount(3);
        good.Prices.Select(p => p.Kind).Should().BeEquivalentTo(new[]
        {
            SupplierChargeKind.Fill, SupplierChargeKind.Purchase, SupplierChargeKind.Deposit
        });
        good.Prices.Single(p => p.Kind == SupplierChargeKind.Deposit).Note.Should().Be("vratná");
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_CreateGood_SupplierNotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new CreateSupplierGoodRequest
        {
            Id = Guid.NewGuid(),
            Data = SupplierBuilder.BuildGoodUpsertDto()
        };

        var endpoint = EndpointBuilder<CreateSupplierGoodRequest, CreateSupplierGoodEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}

public sealed class UpdateSupplierGoodTests
{
    [Fact]
    public async Task ProcessAsync_UpdateGood_ReplacesPricesRatherThanMerging()
    {
        var goodId = Guid.NewGuid();
        var good = SupplierBuilder.BuildGood(
            publicId: goodId,
            name: "CO₂ láhev",
            size: "10 kg",
            prices:
            [
                SupplierBuilder.BuildPrice(SupplierChargeKind.Fill, 450m, 372m),
                SupplierBuilder.BuildPrice(SupplierChargeKind.Deposit, 1200m)
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(supplierGoods: [good]);

        var command = new UpdateSupplierGoodRequest
        {
            GoodId = goodId,
            Data = SupplierBuilder.BuildGoodUpsertDto(
                name: "CO₂ láhev",
                size: "30 kg",
                prices: [SupplierBuilder.BuildPriceUpsertDto(SupplierChargeKind.Fill, 980m, 810m)])
        };

        var endpoint = EndpointBuilder<UpdateSupplierGoodRequest, UpdateSupplierGoodEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        good.Size.Should().Be("30 kg");
        // The deposit row was dropped in the editor, so it has to be gone here too.
        good.Prices.Should().HaveCount(1);
        good.Prices.Single().Kind.Should().Be(SupplierChargeKind.Fill);
        good.Prices.Single().PriceWithVat.Should().Be(980m);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdateGood_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateSupplierGoodRequest
        {
            GoodId = Guid.NewGuid(),
            Data = SupplierBuilder.BuildGoodUpsertDto()
        };

        var endpoint = EndpointBuilder<UpdateSupplierGoodRequest, UpdateSupplierGoodEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}

public sealed class DeleteSupplierGoodTests
{
    [Fact]
    public async Task ProcessAsync_DeleteGood_Success()
    {
        var goodId = Guid.NewGuid();
        var good = SupplierBuilder.BuildGood(publicId: goodId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(supplierGoods: [good]);

        var endpoint = EndpointBuilder<DeleteSupplierGoodRequest, DeleteSupplierGoodEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new DeleteSupplierGoodRequest { GoodId = goodId }, CancellationToken.None);

        dbContext.Verify(e => e.SupplierGoods.Remove(good), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_DeleteGood_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointBuilder<DeleteSupplierGoodRequest, DeleteSupplierGoodEndpoint>.Create(dbContext.Object);

        var act = async () =>
            await endpoint.HandleAsync(new DeleteSupplierGoodRequest { GoodId = Guid.NewGuid() }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}

public sealed class SupplierGoodValidatorTests
{
    private static SupplierGoodUpsertDtoValidator Validator() => new();

    [Fact]
    public void Validate_GoodWithOnePrice_IsValid()
    {
        Validator().Validate(SupplierBuilder.BuildGoodUpsertDto()).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_GoodWithNoPrice_IsRejected()
    {
        var result = Validator().Validate(SupplierBuilder.BuildGoodUpsertDto(prices: []));

        result.IsValid.Should().BeFalse();
    }

    /// <summary>
    /// Mirrors the unique (good, kind) index — a duplicate has to come back as a 400, not as a
    /// database error, and the ceník's grouping depends on it holding.
    /// </summary>
    [Fact]
    public void Validate_DuplicateChargeKind_IsRejected()
    {
        var result = Validator().Validate(SupplierBuilder.BuildGoodUpsertDto(prices:
        [
            SupplierBuilder.BuildPriceUpsertDto(SupplierChargeKind.Fill, 450m),
            SupplierBuilder.BuildPriceUpsertDto(SupplierChargeKind.Fill, 500m)
        ]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_NegativePrice_IsRejected()
    {
        var result = Validator().Validate(SupplierBuilder.BuildGoodUpsertDto(prices:
            [SupplierBuilder.BuildPriceUpsertDto(SupplierChargeKind.Fill, -1m)]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_ZeroPrice_IsAllowed()
    {
        var result = Validator().Validate(SupplierBuilder.BuildGoodUpsertDto(prices:
            [SupplierBuilder.BuildPriceUpsertDto(SupplierChargeKind.Other, 0m)]));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_MissingName_IsRejected()
    {
        Validator().Validate(SupplierBuilder.BuildGoodUpsertDto(name: "")).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_SizeOverTwentyCharacters_IsRejected()
    {
        var result = Validator().Validate(SupplierBuilder.BuildGoodUpsertDto(size: new string('x', 21)));

        result.IsValid.Should().BeFalse();
    }
}
