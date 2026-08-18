using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Suppliers.Queries.Detail;
using AleTrack.Features.Suppliers.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Suppliers;

public sealed class GetSupplierListTests
{
    /// <summary>
    /// The list carries what the list renders — including the whole week, which the "Dnes"
    /// column needs. If this ever thins out to id/name, the screen silently falls back to a
    /// detail call per row.
    /// </summary>
    [Fact]
    public async Task HandleAsync_List_CarriesAddressContactsGoodsCountAndTheWholeWeek()
    {
        var supplier = SupplierBuilder.BuildEntity(
            name: "Linde Gas — plnírna Liberec",
            businessName: "Linde Gas a.s.",
            officialAddress: AddressBuilder.BuildEntity(city: "Praha"),
            contacts: [new Entities.SupplierContact { Type = ContactType.Phone, Value = "+420 485 100 240" }],
            openingHours:
            [
                SupplierBuilder.BuildHours(DayOfWeek.Monday, "07:00", "11:30"),
                SupplierBuilder.BuildHours(DayOfWeek.Monday, "12:00", "15:30")
            ],
            goods: [SupplierBuilder.BuildGood(id: 1), SupplierBuilder.BuildGood(id: 2)]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<SupplierListItemDto>, GetSupplierListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().HaveCount(1);
        var row = endpoint.Response.Single();
        row.Name.Should().Be("Linde Gas — plnírna Liberec");
        row.BusinessName.Should().Be("Linde Gas a.s.");
        row.OfficialAddress.City.Should().Be("Praha");
        row.Contacts.Should().HaveCount(1);
        row.GoodsCount.Should().Be(2);
        // Names, not the whole price list: the list is searchable by what a supplier sells.
        row.GoodNames.Should().HaveCount(2);
        row.OpeningHours.Should().HaveCount(2);
    }

    [Fact]
    public async Task HandleAsync_List_OrdersHoursByDayThenStart()
    {
        var supplier = SupplierBuilder.BuildEntity(openingHours:
        [
            SupplierBuilder.BuildHours(DayOfWeek.Friday, "07:00", "13:00"),
            SupplierBuilder.BuildHours(DayOfWeek.Monday, "12:00", "15:30"),
            SupplierBuilder.BuildHours(DayOfWeek.Monday, "07:00", "11:30")
        ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<SupplierListItemDto>, GetSupplierListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Single().OpeningHours
            .Select(h => (h.DayOfWeek, h.From.Hour))
            .Should().Equal((DayOfWeek.Monday, 7), (DayOfWeek.Monday, 12), (DayOfWeek.Friday, 7));
    }

    [Fact]
    public async Task HandleAsync_List_EmptyWhenNoSuppliers()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<SupplierListItemDto>, GetSupplierListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().BeEmpty();
    }
}

public sealed class GetSupplierDetailTests
{
    [Fact]
    public async Task HandleAsync_Detail_ProjectsGoodsWithPricesOrderedByChargeKind()
    {
        var supplierId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(
            publicId: supplierId,
            note: "Hlásit se na váhu.",
            contactAddress: AddressBuilder.BuildEntity(city: "Liberec"),
            goods:
            [
                SupplierBuilder.BuildGood(
                    name: "CO₂ láhev",
                    size: "10 kg",
                    prices:
                    [
                        // Deliberately out of order — the projection has to sort them.
                        SupplierBuilder.BuildPrice(SupplierChargeKind.Deposit, 1200m, note: "vratná"),
                        SupplierBuilder.BuildPrice(SupplierChargeKind.Fill, 450m, 372m),
                        SupplierBuilder.BuildPrice(SupplierChargeKind.Purchase, 2900m, 2397m)
                    ])
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var endpoint = EndpointWithResponseBuilder<GetSupplierDetailRequest, SupplierDto, GetSupplierDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetSupplierDetailRequest { Id = supplierId }, CancellationToken.None);

        var dto = endpoint.Response;
        dto.Id.Should().Be(supplierId);
        dto.Note.Should().Be("Hlásit se na váhu.");
        dto.ContactAddress.Should().NotBeNull();
        dto.ContactAddress!.City.Should().Be("Liberec");
        dto.Goods.Should().HaveCount(1);
        dto.Goods.Single().Prices.Select(p => p.Kind).Should().Equal(
            SupplierChargeKind.Fill, SupplierChargeKind.Purchase, SupplierChargeKind.Deposit);
        dto.Goods.Single().Prices.First().PriceWithoutVat.Should().Be(372m);
    }

    [Fact]
    public async Task HandleAsync_Detail_NullContactAddressStaysNull()
    {
        var supplierId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId, contactAddress: null);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var endpoint = EndpointWithResponseBuilder<GetSupplierDetailRequest, SupplierDto, GetSupplierDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetSupplierDetailRequest { Id = supplierId }, CancellationToken.None);

        endpoint.Response.ContactAddress.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_Detail_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointWithResponseBuilder<GetSupplierDetailRequest, SupplierDto, GetSupplierDetailEndpoint>
            .Create(dbContext.Object);

        var act = async () =>
            await endpoint.HandleAsync(new GetSupplierDetailRequest { Id = Guid.NewGuid() }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
