using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.ProductDeliveries.Commands.Create;
using AleTrack.Features.ProductDeliveries.Commands.Update;
using AleTrack.Features.ProductDeliveries.Queries.Detail;
using AleTrack.Features.ProductDeliveries.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.ProductDeliveries;

/// <summary>
/// A dovoz calling at a supplier: the goods it collects, and the shapes the write endpoints refuse.
/// </summary>
public sealed class SupplierDeliveryStopTests
{
    [Fact]
    public async Task Create_SupplierStop_StoresTheGoodAndItsChargeKind()
    {
        var supplierId = Guid.NewGuid();
        var goodId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId, id: 7);
        var good = SupplierBuilder.BuildGood(
            publicId: goodId,
            id: 3,
            supplierId: 7,
            prices: [SupplierBuilder.BuildPrice(SupplierChargeKind.Fill, 640m)]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            suppliers: [supplier],
            supplierGoods: [good]);

        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(stops:
            [
                ProductDeliveryBuilder.BuildCreateSupplierStopDto(
                    supplierId: supplierId,
                    products:
                    [
                        ProductDeliveryBuilder.BuildCreateGoodItemDto(
                            supplierGoodId: goodId,
                            chargeKind: SupplierChargeKind.Fill,
                            quantity: 2,
                            note: "vyměnit za prázdné")
                    ])
            ])
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.ProductDeliveries.Add(It.Is<ProductDelivery>(pd =>
            pd.Stops.Count == 1 &&
            pd.Stops[0].Kind == DeliveryStopKind.Supplier &&
            pd.Stops[0].Supplier == supplier &&
            pd.Stops[0].Brewery == null &&
            pd.Stops[0].Items.Count == 1 &&
            pd.Stops[0].Items[0].SupplierGood == good &&
            pd.Stops[0].Items[0].ChargeKind == SupplierChargeKind.Fill &&
            pd.Stops[0].Items[0].Quantity == 2 &&
            pd.Stops[0].Items[0].Note == "vyměnit za prázdné" &&
            pd.Stops[0].Items[0].Product == null
        )), Times.Once);
    }

    /// <summary>
    /// The weight-input columns describe a product's packaging. A good has none, and the check
    /// constraint on delivery_items rejects a row that fills them anyway — so the endpoint has to
    /// leave them alone rather than default them.
    /// </summary>
    [Fact]
    public async Task Create_SupplierStop_LeavesTheWeightInputsUnset()
    {
        var supplierId = Guid.NewGuid();
        var goodId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId, id: 7);
        var good = SupplierBuilder.BuildGood(publicId: goodId, id: 3, supplierId: 7);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            suppliers: [supplier],
            supplierGoods: [good]);

        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(stops:
            [
                ProductDeliveryBuilder.BuildCreateSupplierStopDto(
                    supplierId: supplierId,
                    products: [ProductDeliveryBuilder.BuildCreateGoodItemDto(supplierGoodId: goodId)])
            ])
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.ProductDeliveries.Add(It.Is<ProductDelivery>(pd =>
            pd.Stops[0].Items[0].Kind == null &&
            pd.Stops[0].Items[0].PackageSize == null &&
            pd.Stops[0].Items[0].UnitsPerPackage == null
        )), Times.Once);
    }

    [Fact]
    public async Task Create_OneTripCanCallAtBothABreweryAndASupplier()
    {
        var breweryId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var goodId = Guid.NewGuid();

        var brewery = BreweryBuilder.BuildEntity(publicId: breweryId);
        var product = ProductBuilder.BuildEntity(publicId: productId);
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId, id: 7);
        var good = SupplierBuilder.BuildGood(publicId: goodId, id: 3, supplierId: 7);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            breweries: [brewery],
            products: [product],
            suppliers: [supplier],
            supplierGoods: [good]);

        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(stops:
            [
                ProductDeliveryBuilder.BuildCreateStopDto(
                    breweryId: breweryId,
                    products: [ProductDeliveryBuilder.BuildCreateItemDto(productId: productId)]),
                ProductDeliveryBuilder.BuildCreateSupplierStopDto(
                    supplierId: supplierId,
                    products: [ProductDeliveryBuilder.BuildCreateGoodItemDto(supplierGoodId: goodId)])
            ])
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.ProductDeliveries.Add(It.Is<ProductDelivery>(pd =>
            pd.Stops.Count == 2 &&
            pd.Stops[0].Order == 0 &&
            pd.Stops[0].Brewery == brewery &&
            pd.Stops[0].Items[0].Product == product &&
            pd.Stops[1].Order == 1 &&
            pd.Stops[1].Supplier == supplier &&
            pd.Stops[1].Items[0].SupplierGood == good
        )), Times.Once);
    }

    /// <summary>
    /// The same bottle can be on one trip to be refilled and to be paid rent on. Those are two
    /// lines at two prices, so the charge kind has to be what tells them apart.
    /// </summary>
    [Fact]
    public async Task Create_SameGoodUnderTwoChargeKinds_IsTwoLines()
    {
        var supplierId = Guid.NewGuid();
        var goodId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId, id: 7);
        var good = SupplierBuilder.BuildGood(
            publicId: goodId,
            id: 3,
            supplierId: 7,
            prices:
            [
                SupplierBuilder.BuildPrice(SupplierChargeKind.Fill, 640m),
                SupplierBuilder.BuildPrice(SupplierChargeKind.Rent, 90m)
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            suppliers: [supplier],
            supplierGoods: [good]);

        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(stops:
            [
                ProductDeliveryBuilder.BuildCreateSupplierStopDto(
                    supplierId: supplierId,
                    products:
                    [
                        ProductDeliveryBuilder.BuildCreateGoodItemDto(supplierGoodId: goodId, chargeKind: SupplierChargeKind.Fill),
                        ProductDeliveryBuilder.BuildCreateGoodItemDto(supplierGoodId: goodId, chargeKind: SupplierChargeKind.Rent)
                    ])
            ])
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.ProductDeliveries.Add(It.Is<ProductDelivery>(pd =>
            pd.Stops[0].Items.Count == 2 &&
            pd.Stops[0].Items.Any(i => i.ChargeKind == SupplierChargeKind.Fill) &&
            pd.Stops[0].Items.Any(i => i.ChargeKind == SupplierChargeKind.Rent)
        )), Times.Once);
    }

    [Fact]
    public async Task Create_GoodPricedByAnotherSupplier_IsRejected()
    {
        var supplierId = Guid.NewGuid();
        var goodId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId, id: 7);
        // Priced by supplier 8 — a real good, but not this stop's.
        var good = SupplierBuilder.BuildGood(publicId: goodId, id: 3, supplierId: 8);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            suppliers: [supplier],
            supplierGoods: [good]);

        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(stops:
            [
                ProductDeliveryBuilder.BuildCreateSupplierStopDto(
                    supplierId: supplierId,
                    products: [ProductDeliveryBuilder.BuildCreateGoodItemDto(supplierGoodId: goodId)])
            ])
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ProductDeliveryErrorCodes.SupplierGoodNotFromStopSupplierError);
    }

    [Fact]
    public async Task Create_ChargeKindTheGoodHasNoPriceFor_IsRejected()
    {
        var supplierId = Guid.NewGuid();
        var goodId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId, id: 7);
        var good = SupplierBuilder.BuildGood(
            publicId: goodId,
            id: 3,
            supplierId: 7,
            prices: [SupplierBuilder.BuildPrice(SupplierChargeKind.Fill, 640m)]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            suppliers: [supplier],
            supplierGoods: [good]);

        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(stops:
            [
                ProductDeliveryBuilder.BuildCreateSupplierStopDto(
                    supplierId: supplierId,
                    products: [ProductDeliveryBuilder.BuildCreateGoodItemDto(supplierGoodId: goodId, chargeKind: SupplierChargeKind.Rent)])
            ])
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ProductDeliveryErrorCodes.SupplierGoodPriceMissingError);
    }

    /// <summary>
    /// A supplier is softly deleted so old records stay resolvable, which is not the same as being
    /// somewhere a van can still be sent.
    /// </summary>
    [Fact]
    public async Task Create_DeletedSupplier_IsNotFound()
    {
        var supplierId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId, id: 7);
        supplier.IsDeleted = true;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(stops:
            [
                ProductDeliveryBuilder.BuildCreateSupplierStopDto(supplierId: supplierId)
            ])
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>();
    }

    /// <summary>
    /// Editing a stop from a brewery to a supplier has to drop the brewery, not merely gain the
    /// supplier — otherwise the row ends up naming both.
    /// </summary>
    [Fact]
    public async Task Update_BreweryStopChangedToSupplier_DropsTheBrewery()
    {
        var deliveryId = Guid.NewGuid();
        var stopId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var goodId = Guid.NewGuid();

        var brewery = BreweryBuilder.BuildEntity();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId, id: 7);
        var good = SupplierBuilder.BuildGood(publicId: goodId, id: 3, supplierId: 7);

        var stop = ProductDeliveryBuilder.BuildDeliveryStopEntity(
            publicId: stopId,
            brewery: brewery,
            items: [ProductDeliveryBuilder.BuildDeliveryItemEntity()]);
        var delivery = ProductDeliveryBuilder.BuildEntity(publicId: deliveryId, stops: [stop]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            productDeliveries: [delivery],
            breweries: [brewery],
            suppliers: [supplier],
            supplierGoods: [good]);

        var command = new UpdateProductDeliveryRequest
        {
            Id = deliveryId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(stops:
            [
                ProductDeliveryBuilder.BuildUpdateSupplierStopDto(
                    publicId: stopId,
                    supplierId: supplierId,
                    products: [ProductDeliveryBuilder.BuildUpdateGoodItemDto(supplierGoodId: goodId)])
            ])
        };

        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        stop.Kind.Should().Be(DeliveryStopKind.Supplier);
        stop.Supplier.Should().Be(supplier);
        stop.Brewery.Should().BeNull();
        stop.BreweryId.Should().BeNull();
        stop.Items.Should().HaveCount(1);
        stop.Items[0].SupplierGood.Should().Be(good);
        stop.Items[0].Product.Should().BeNull();
    }

    /// <summary>
    /// Finishing a dovoz books everything it brought back into stock — the beer from the brewery and
    /// the goods from the supplier alike.
    /// </summary>
    [Fact]
    public async Task Update_FinishingADeliveryWithGoods_StocksTheProductsAndTheGoods()
    {
        var deliveryId = Guid.NewGuid();
        var breweryStopId = Guid.NewGuid();
        var supplierStopId = Guid.NewGuid();
        var breweryId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var goodId = Guid.NewGuid();

        var brewery = BreweryBuilder.BuildEntity(publicId: breweryId);
        var product = ProductBuilder.BuildEntity(publicId: productId);
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId, id: 7);
        var good = SupplierBuilder.BuildGood(publicId: goodId, id: 3, supplierId: 7);

        var delivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            stops:
            [
                ProductDeliveryBuilder.BuildDeliveryStopEntity(publicId: breweryStopId, brewery: brewery),
                ProductDeliveryBuilder.BuildSupplierStopEntity(publicId: supplierStopId, supplier: supplier, order: 1)
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            productDeliveries: [delivery],
            breweries: [brewery],
            products: [product],
            suppliers: [supplier],
            supplierGoods: [good],
            inventoryItems: []);

        var command = new UpdateProductDeliveryRequest
        {
            Id = deliveryId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(
                state: ProductDeliveryState.Finished,
                stops:
                [
                    ProductDeliveryBuilder.BuildUpdateStopDto(
                        publicId: breweryStopId,
                        breweryId: breweryId,
                        products: [ProductDeliveryBuilder.BuildUpdateItemDto(productId: productId, quantity: 4)]),
                    ProductDeliveryBuilder.BuildUpdateSupplierStopDto(
                        publicId: supplierStopId,
                        supplierId: supplierId,
                        products: [ProductDeliveryBuilder.BuildUpdateGoodItemDto(supplierGoodId: goodId, quantity: 2)])
                ])
        };

        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.InventoryItems.AddRange(It.Is<IEnumerable<InventoryItem>>(items =>
            items.Count() == 2
            && items.Any(i => i.Product == product && i.SupplierGood == null && i.Quantity == 4)
            && items.Any(i => i.SupplierGood == good && i.Product == null && i.Quantity == 2))), Times.Once);
    }

    [Fact]
    public async Task Detail_SupplierStop_NamesTheGoodAndItsSize()
    {
        var deliveryId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var goodId = Guid.NewGuid();

        var supplier = SupplierBuilder.BuildEntity(
            publicId: supplierId,
            id: 7,
            name: "Linde Gas",
            officialAddress: AddressBuilder.BuildEntity(latitude: 50.77m, longitude: 15.05m));
        var good = SupplierBuilder.BuildGood(publicId: goodId, id: 3, supplierId: 7, name: "CO₂ láhev", size: "10 kg");

        var delivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            stops:
            [
                ProductDeliveryBuilder.BuildSupplierStopEntity(
                    supplier: supplier,
                    items:
                    [
                        ProductDeliveryBuilder.BuildDeliveryGoodItemEntity(
                            supplierGood: good,
                            chargeKind: SupplierChargeKind.Fill,
                            quantity: 2)
                    ])
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(productDeliveries: [delivery]);

        var endpoint = EndpointWithResponseBuilder<GetProductDeliveryDetailRequest, ProductDeliveryDto, GetProductDeliveryDetailEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new GetProductDeliveryDetailRequest { Id = deliveryId }, CancellationToken.None);

        var result = endpoint.Response;
        var stop = result.Stops.Should().ContainSingle().Subject;

        stop.Kind.Should().Be(DeliveryStopKind.Supplier);
        stop.Brewery.Should().BeNull();
        stop.Supplier.Should().NotBeNull();
        stop.Supplier!.Name.Should().Be("Linde Gas");

        var line = stop.Products.Should().ContainSingle().Subject;
        line.Name.Should().Be("CO₂ láhev");
        line.Size.Should().Be("10 kg");
        line.SupplierGoodId.Should().Be(goodId);
        line.ChargeKind.Should().Be(SupplierChargeKind.Fill);
        line.ProductId.Should().BeNull();
        line.Quantity.Should().Be(2);
    }

    /// <summary>
    /// The map needs the branch actually visited when it is geocoded, and the registered seat when
    /// it is not. Resolved server-side so a planner without the Suppliers permission still gets a
    /// complete route.
    /// </summary>
    [Fact]
    public async Task Detail_SupplierStop_PrefersTheGeocodedContactAddress()
    {
        var deliveryId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(
            id: 7,
            officialAddress: AddressBuilder.BuildEntity(latitude: 50.08m, longitude: 14.44m),
            contactAddress: AddressBuilder.BuildEntity(latitude: 50.77m, longitude: 15.05m));

        var delivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            stops: [ProductDeliveryBuilder.BuildSupplierStopEntity(supplier: supplier)]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(productDeliveries: [delivery]);

        var endpoint = EndpointWithResponseBuilder<GetProductDeliveryDetailRequest, ProductDeliveryDto, GetProductDeliveryDetailEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new GetProductDeliveryDetailRequest { Id = deliveryId }, CancellationToken.None);

        var stop = endpoint.Response.Stops.Should().ContainSingle().Subject;
        stop.Supplier!.Latitude.Should().Be(50.77m);
        stop.Supplier.Longitude.Should().Be(15.05m);
    }

    /// <summary>
    /// A branch address with no coordinates must not blank the pin — and must not contribute one of
    /// the two coordinates while the seat contributes the other, which would place it in a field
    /// between them.
    /// </summary>
    [Fact]
    public async Task Detail_UngeocodedContactAddress_FallsBackToTheSeatForBothCoordinates()
    {
        var deliveryId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(
            id: 7,
            officialAddress: AddressBuilder.BuildEntity(latitude: 50.08m, longitude: 14.44m),
            contactAddress: AddressBuilder.BuildEntity(latitude: null, longitude: null));

        var delivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            stops: [ProductDeliveryBuilder.BuildSupplierStopEntity(supplier: supplier)]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(productDeliveries: [delivery]);

        var endpoint = EndpointWithResponseBuilder<GetProductDeliveryDetailRequest, ProductDeliveryDto, GetProductDeliveryDetailEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new GetProductDeliveryDetailRequest { Id = deliveryId }, CancellationToken.None);

        var stop = endpoint.Response.Stops.Should().ContainSingle().Subject;
        stop.Supplier!.Latitude.Should().Be(50.08m);
        stop.Supplier.Longitude.Should().Be(14.44m);
    }
}

/// <summary>
/// The shape rules, exercised through both payloads — the point of sharing them is that neither
/// endpoint can be the one that forgets.
/// </summary>
public sealed class SupplierDeliveryStopValidatorTests
{
    private static CreateProductsDeliveryDtoValidator CreateValidator() => new();

    private static UpdateProductDeliveryDtoValidator UpdateValidator() => new();

    [Fact]
    public void Create_SupplierStopWithoutASupplier_IsRejected()
    {
        var stop = ProductDeliveryBuilder.BuildCreateSupplierStopDto();
        stop.SupplierId = null;

        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops: [stop]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Create_BreweryStopCarryingASupplierId_IsRejected()
    {
        var stop = ProductDeliveryBuilder.BuildCreateStopDto(
            products: [ProductDeliveryBuilder.BuildCreateItemDto()]);
        stop.SupplierId = Guid.NewGuid();

        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops: [stop]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Create_SupplierStopCarryingABreweryId_IsRejected()
    {
        var stop = ProductDeliveryBuilder.BuildCreateSupplierStopDto(
            products: [ProductDeliveryBuilder.BuildCreateGoodItemDto()]);
        stop.BreweryId = Guid.NewGuid();

        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops: [stop]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Create_TwoStopsAtTheSameSupplier_AreRejected()
    {
        var supplierId = Guid.NewGuid();
        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops:
        [
            ProductDeliveryBuilder.BuildCreateSupplierStopDto(supplierId: supplierId, products: [ProductDeliveryBuilder.BuildCreateGoodItemDto()]),
            ProductDeliveryBuilder.BuildCreateSupplierStopDto(supplierId: supplierId, products: [ProductDeliveryBuilder.BuildCreateGoodItemDto()])
        ]));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("dodavatelů"));
    }

    /// <summary>
    /// Several unnamed waypoints on one route are ordinary, so the repeated-place rule must not
    /// mistake them for a repeated place.
    /// </summary>
    [Fact]
    public void Create_SeveralCustomStops_AreAllowed()
    {
        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops:
        [
            ProductDeliveryBuilder.BuildCreateCustomStopDto(label: "Čerpací stanice"),
            ProductDeliveryBuilder.BuildCreateCustomStopDto(label: "Oběd")
        ]));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Create_LineNamingBothAProductAndAGood_IsRejected()
    {
        var line = ProductDeliveryBuilder.BuildCreateGoodItemDto();
        line.ProductId = Guid.NewGuid();

        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops:
        [
            ProductDeliveryBuilder.BuildCreateSupplierStopDto(products: [line])
        ]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Create_LineNamingNeitherAProductNorAGood_IsRejected()
    {
        var line = ProductDeliveryBuilder.BuildCreateItemDto();
        line.ProductId = null;

        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops:
        [
            ProductDeliveryBuilder.BuildCreateStopDto(products: [line])
        ]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Create_GoodWithoutAChargeKind_IsRejected()
    {
        var line = ProductDeliveryBuilder.BuildCreateGoodItemDto();
        line.ChargeKind = null;

        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops:
        [
            ProductDeliveryBuilder.BuildCreateSupplierStopDto(products: [line])
        ]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Create_ChargeKindOnAProductLine_IsRejected()
    {
        var line = ProductDeliveryBuilder.BuildCreateItemDto();
        line.ChargeKind = SupplierChargeKind.Fill;

        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops:
        [
            ProductDeliveryBuilder.BuildCreateStopDto(products: [line])
        ]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Create_GoodOnABreweryStop_IsRejected()
    {
        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops:
        [
            ProductDeliveryBuilder.BuildCreateStopDto(products: [ProductDeliveryBuilder.BuildCreateGoodItemDto()])
        ]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Create_ProductOnASupplierStop_IsRejected()
    {
        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops:
        [
            ProductDeliveryBuilder.BuildCreateSupplierStopDto(products: [ProductDeliveryBuilder.BuildCreateItemDto()])
        ]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Create_ItemsOnACustomStop_AreRejected()
    {
        var stop = ProductDeliveryBuilder.BuildCreateCustomStopDto();
        stop.Products = [ProductDeliveryBuilder.BuildCreateItemDto()];

        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops: [stop]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Create_SameGoodAndChargeKindTwice_IsRejected()
    {
        var goodId = Guid.NewGuid();
        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops:
        [
            ProductDeliveryBuilder.BuildCreateSupplierStopDto(products:
            [
                ProductDeliveryBuilder.BuildCreateGoodItemDto(supplierGoodId: goodId, chargeKind: SupplierChargeKind.Fill),
                ProductDeliveryBuilder.BuildCreateGoodItemDto(supplierGoodId: goodId, chargeKind: SupplierChargeKind.Fill)
            ])
        ]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Create_SameGoodUnderDifferentChargeKinds_IsAllowed()
    {
        var goodId = Guid.NewGuid();
        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops:
        [
            ProductDeliveryBuilder.BuildCreateSupplierStopDto(products:
            [
                ProductDeliveryBuilder.BuildCreateGoodItemDto(supplierGoodId: goodId, chargeKind: SupplierChargeKind.Fill),
                ProductDeliveryBuilder.BuildCreateGoodItemDto(supplierGoodId: goodId, chargeKind: SupplierChargeKind.Rent)
            ])
        ]));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Create_ValidSupplierStop_IsAccepted()
    {
        var result = CreateValidator().Validate(ProductDeliveryBuilder.BuildCreateDto(stops:
        [
            ProductDeliveryBuilder.BuildCreateSupplierStopDto(products: [ProductDeliveryBuilder.BuildCreateGoodItemDto()])
        ]));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Update_SupplierStopWithoutASupplier_IsRejected()
    {
        var stop = ProductDeliveryBuilder.BuildUpdateSupplierStopDto();
        stop.SupplierId = null;

        var result = UpdateValidator().Validate(ProductDeliveryBuilder.BuildUpdateDto(stops: [stop]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Update_GoodWithoutAChargeKind_IsRejected()
    {
        var line = ProductDeliveryBuilder.BuildUpdateGoodItemDto();
        line.ChargeKind = null;

        var result = UpdateValidator().Validate(ProductDeliveryBuilder.BuildUpdateDto(stops:
        [
            ProductDeliveryBuilder.BuildUpdateSupplierStopDto(products: [line])
        ]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Update_TwoStopsAtTheSameSupplier_AreRejected()
    {
        var supplierId = Guid.NewGuid();
        var result = UpdateValidator().Validate(ProductDeliveryBuilder.BuildUpdateDto(stops:
        [
            ProductDeliveryBuilder.BuildUpdateSupplierStopDto(supplierId: supplierId, products: [ProductDeliveryBuilder.BuildUpdateGoodItemDto()]),
            ProductDeliveryBuilder.BuildUpdateSupplierStopDto(supplierId: supplierId, products: [ProductDeliveryBuilder.BuildUpdateGoodItemDto()])
        ]));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Update_ValidSupplierStop_IsAccepted()
    {
        var result = UpdateValidator().Validate(ProductDeliveryBuilder.BuildUpdateDto(stops:
        [
            ProductDeliveryBuilder.BuildUpdateSupplierStopDto(products: [ProductDeliveryBuilder.BuildUpdateGoodItemDto()])
        ]));

        result.IsValid.Should().BeTrue();
    }
}
