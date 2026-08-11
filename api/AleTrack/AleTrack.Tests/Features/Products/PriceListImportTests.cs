using System.Text;
using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Breweries.Commands.ApplyPriceList;
using AleTrack.Features.Breweries.Commands.PreviewPriceList;
using AleTrack.Features.Products.Import;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// The preview and apply endpoints. An import rewrites every price a brewery sells at, so the two
/// properties that matter most are that a preview writes nothing and that an apply cannot be handed
/// a different file than the one that was reviewed.
/// </summary>
public sealed class PriceListImportTests
{
    private const string Header =
        "name,type,alcohol,plato,container,volume_l,sale_unit,units,unit_novat,unit_vat,pack_novat,pack_vat";

    private const string DesitkaCrate =
        "Svijanská Desítka 10%,PaleDraftBeer,4.0,10,Bottle,0.5,Crate,20,13.14,15.90,,318.00";

    private static string File(params string[] rows) =>
        string.Join("\n", ["# source: pivovarsvijany.cz/file/2336", Header, .. rows]);

    private static IFormFile Upload(string content)
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "price-list.csv");
    }

    private static readonly DateTimeOffset Now = new(2026, 8, 11, 12, 0, 0, TimeSpan.Zero);

    /// <summary>The injected clock, pinned so a recorded timestamp is assertable.</summary>
    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private static Mock<IAppContext> AppContext()
    {
        var appContext = new Mock<IAppContext>();
        appContext.SetupGet(a => a.UserId).Returns((Guid?)null);
        return appContext;
    }

    private static Product Desitka(decimal priceWithVat = 296.00m) => ProductBuilder.BuildEntity(
        name: "Svijanská Desítka",
        type: ProductType.PaleDraftBeer,
        alcoholPercentage: 4.0f,
        platoDegree: 10f,
        packageSize: 0.5,
        container: ProductContainer.Bottle,
        saleUnit: ProductSaleUnit.Crate,
        unitsPerPackage: 20,
        priceWithVat: priceWithVat,
        priceForUnitWithVat: 14.80m,
        priceForUnitWithoutVat: 12.23m);

    private static Brewery BreweryWith(params Product[] products)
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Svijany");
        foreach (var product in products)
        {
            brewery.Products.Add(product);
        }

        return brewery;
    }

    [Fact]
    public async Task Preview_RepricedProduct_IsReportedAndNothingIsWritten()
    {
        var brewery = BreweryWith(Desitka());
        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);

        var endpoint = EndpointWithResponseBuilder<PreviewPriceListRequest, PriceListPreviewDto, PreviewPriceListEndpoint>
            .Create(dbContext.Object);

        await endpoint.HandleAsync(new PreviewPriceListRequest
        {
            Id = brewery.PublicId,
            File = Upload(File(DesitkaCrate)),
            EffectiveFrom = new DateOnly(2026, 5, 1)
        }, CancellationToken.None);

        var response = endpoint.Response;
        response.BreweryName.Should().Be("Svijany");
        response.SourceName.Should().Be("pivovarsvijany.cz/file/2336");
        response.Summary.Repriced.Should().Be(1);
        response.Items.Should().ContainSingle()
            .Which.Changes.Should().Contain(c => c.Before == "296" && c.After == "318");

        // A preview that wrote anything would defeat the point of reviewing it first.
        brewery.Products.Single().PriceWithVat.Should().Be(296.00m);
        dbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Preview_HandsOutAHashThatIdentifiesTheReviewedFile()
    {
        var brewery = BreweryWith();
        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);
        var content = File(DesitkaCrate);

        var endpoint = EndpointWithResponseBuilder<PreviewPriceListRequest, PriceListPreviewDto, PreviewPriceListEndpoint>
            .Create(dbContext.Object);

        await endpoint.HandleAsync(new PreviewPriceListRequest
        {
            Id = brewery.PublicId,
            File = Upload(content),
            EffectiveFrom = new DateOnly(2026, 5, 1)
        }, CancellationToken.None);

        endpoint.Response.SourceHash.Should().Be(PriceListSourceHash.Compute(content));
    }

    [Fact]
    public async Task Preview_UnknownBrewery_Returns404()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointWithResponseBuilder<PreviewPriceListRequest, PriceListPreviewDto, PreviewPriceListEndpoint>
            .Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(new PreviewPriceListRequest
        {
            Id = Guid.NewGuid(),
            File = Upload(File(DesitkaCrate)),
            EffectiveFrom = new DateOnly(2026, 5, 1)
        }, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode
            .Should().Be(StatusCodes.Status404NotFound);
    }

    [Fact]
    public async Task Preview_UnreadableFile_Returns400WithEveryReason()
    {
        var brewery = BreweryWith();
        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);

        var endpoint = EndpointWithResponseBuilder<PreviewPriceListRequest, PriceListPreviewDto, PreviewPriceListEndpoint>
            .Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(new PreviewPriceListRequest
        {
            Id = brewery.PublicId,
            File = Upload(File("Desítka,NotAStyle,4.0,10,Bottle,0.5,Crate,20,,,,318.00")),
            EffectiveFrom = new DateOnly(2026, 5, 1)
        }, CancellationToken.None);

        var exception = (await act.Should().ThrowAsync<AleTrackException>()).Which;
        exception.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        exception.ErrorCode.Should().Be(ErrorCodes.PriceListUnreadable);
    }

    [Fact]
    public async Task Apply_FileOtherThanTheReviewedOne_Returns409AndWritesNothing()
    {
        // The whole point of the hash: the numbers that get written must be the numbers that were
        // approved, and there is no server-side pending import to check them against.
        var brewery = BreweryWith(Desitka());
        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);

        var endpoint = EndpointWithResponseBuilder<ApplyPriceListRequest, PriceListApplyResultDto, ApplyPriceListEndpoint>
            .Create(dbContext.Object, AppContext().Object, new FixedTimeProvider(Now));

        var act = async () => await endpoint.HandleAsync(new ApplyPriceListRequest
        {
            Id = brewery.PublicId,
            File = Upload(File(DesitkaCrate)),
            EffectiveFrom = new DateOnly(2026, 5, 1),
            SourceHash = PriceListSourceHash.Compute(File("something else entirely"))
        }, CancellationToken.None);

        var exception = (await act.Should().ThrowAsync<AleTrackException>()).Which;
        exception.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        exception.ErrorCode.Should().Be(ErrorCodes.PriceListSourceChanged);

        brewery.Products.Single().PriceWithVat.Should().Be(296.00m);
        dbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Apply_RepricesAddsAndRemovesInOneSave()
    {
        var repriced = Desitka();
        var dropped = ProductBuilder.BuildEntity(name: "Zámek", container: ProductContainer.Keg,
            saleUnit: ProductSaleUnit.Single, packageSize: 30, unitsPerPackage: 1);
        var brewery = BreweryWith(repriced, dropped);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);

        var content = File(DesitkaCrate, "Bidlovka,PaleLager,5.0,,Keg,30,Single,1,20.74,25.10,1244.40,1506.00");

        var endpoint = EndpointWithResponseBuilder<ApplyPriceListRequest, PriceListApplyResultDto, ApplyPriceListEndpoint>
            .Create(dbContext.Object, AppContext().Object, new FixedTimeProvider(Now));

        await endpoint.HandleAsync(new ApplyPriceListRequest
        {
            Id = brewery.PublicId,
            File = Upload(content),
            EffectiveFrom = new DateOnly(2026, 5, 1),
            SourceHash = PriceListSourceHash.Compute(content)
        }, CancellationToken.None);

        var response = endpoint.Response;
        response.Added.Should().Be(1);
        response.Updated.Should().Be(1);
        response.Removed.Should().Be(1);
        response.ImportId.Should().NotBeEmpty();

        repriced.PriceWithVat.Should().Be(318.00m);
        repriced.PriceForUnitWithoutVat.Should().Be(13.14m);
        repriced.PriceEffectiveFrom.Should().Be(new DateOnly(2026, 5, 1));

        // The list prints "Svijanská Desítka 10%"; renaming the catalogue to match is exactly what
        // the normalisation exists to avoid.
        repriced.Name.Should().Be("Svijanská Desítka");

        brewery.Products.Should().ContainSingle(p => p.Name == "Bidlovka")
            .Which.Kind.Should().Be(ProductKind.Keg);

        // One save for the whole import, so it commits or rolls back as a unit.
        dbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Apply_ProductWithStockOnHandThatTheListDropped_IsKeptWhileItsNeighbourGoes()
    {
        // Both products are dropped by the list; only the stocked one may survive. Distinct ids
        // matter here — with the default 0 on both, any id comparison would look correct.
        var stocked = Desitka();
        stocked.Id = 1;
        var unused = ProductBuilder.BuildEntity(name: "Zámek", container: ProductContainer.Keg,
            saleUnit: ProductSaleUnit.Single, packageSize: 30, unitsPerPackage: 1);
        unused.Id = 2;

        var brewery = BreweryWith(stocked, unused);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            breweries: [brewery],
            inventoryItems: [new InventoryItem { PublicId = Guid.NewGuid(), ProductId = 1, Quantity = 4 }]);

        var content = File("Bidlovka,PaleLager,5.0,,Keg,30,Single,1,20.74,25.10,1244.40,1506.00");

        var endpoint = EndpointWithResponseBuilder<ApplyPriceListRequest, PriceListApplyResultDto, ApplyPriceListEndpoint>
            .Create(dbContext.Object, AppContext().Object, new FixedTimeProvider(Now));

        await endpoint.HandleAsync(new ApplyPriceListRequest
        {
            Id = brewery.PublicId,
            File = Upload(content),
            EffectiveFrom = new DateOnly(2026, 5, 1),
            SourceHash = PriceListSourceHash.Compute(content)
        }, CancellationToken.None);

        endpoint.Response.Blocked.Should().Be(1);
        endpoint.Response.Removed.Should().Be(1);
        brewery.Products.Should().Contain(stocked);
    }

    [Fact]
    public async Task Apply_ProductOnAnOpenOrderThatTheListDropped_IsAlsoKept()
    {
        // The second Blocked reason: no stock, but an order still due to be delivered.
        var ordered = Desitka();
        ordered.Id = 7;
        var brewery = BreweryWith(ordered);

        var order = new Order { PublicId = Guid.NewGuid(), State = OrderState.Planning };
        order.OrderItems.Add(new OrderItem { PublicId = Guid.NewGuid(), ProductId = 7, Quantity = 2 });

        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery], orders: [order]);
        var content = File("Bidlovka,PaleLager,5.0,,Keg,30,Single,1,20.74,25.10,1244.40,1506.00");

        var endpoint = EndpointWithResponseBuilder<ApplyPriceListRequest, PriceListApplyResultDto, ApplyPriceListEndpoint>
            .Create(dbContext.Object, AppContext().Object, new FixedTimeProvider(Now));

        await endpoint.HandleAsync(new ApplyPriceListRequest
        {
            Id = brewery.PublicId,
            File = Upload(content),
            EffectiveFrom = new DateOnly(2026, 5, 1),
            SourceHash = PriceListSourceHash.Compute(content)
        }, CancellationToken.None);

        endpoint.Response.Blocked.Should().Be(1);
        endpoint.Response.Removed.Should().Be(0);
    }

    [Fact]
    public async Task Apply_FinishedOrderDoesNotProtectAProductTheListDropped()
    {
        // A delivered order is history; it must not pin a product the brewery no longer sells.
        var delivered = Desitka();
        delivered.Id = 9;
        var brewery = BreweryWith(delivered);

        var order = new Order { PublicId = Guid.NewGuid(), State = OrderState.Finished };
        order.OrderItems.Add(new OrderItem { PublicId = Guid.NewGuid(), ProductId = 9, Quantity = 2 });

        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery], orders: [order]);
        var content = File("Bidlovka,PaleLager,5.0,,Keg,30,Single,1,20.74,25.10,1244.40,1506.00");

        var endpoint = EndpointWithResponseBuilder<ApplyPriceListRequest, PriceListApplyResultDto, ApplyPriceListEndpoint>
            .Create(dbContext.Object, AppContext().Object, new FixedTimeProvider(Now));

        await endpoint.HandleAsync(new ApplyPriceListRequest
        {
            Id = brewery.PublicId,
            File = Upload(content),
            EffectiveFrom = new DateOnly(2026, 5, 1),
            SourceHash = PriceListSourceHash.Compute(content)
        }, CancellationToken.None);

        endpoint.Response.Blocked.Should().Be(0);
        endpoint.Response.Removed.Should().Be(1);
    }
}
