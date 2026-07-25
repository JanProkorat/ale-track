using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.AddPurchaseInvoice;
using AleTrack.Features.OutgoingShipments.Commands.DeletePurchaseInvoice;
using AleTrack.Features.OutgoingShipments.Commands.SetPurchaseInvoiceLine;
using AleTrack.Features.OutgoingShipments.Commands.UpdatePurchaseInvoice;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Endpoint-level tests for the split across the invoices the brewery issues to us: opening and
/// deleting one, and setting how many pieces of a product sit on it.
/// </summary>
public sealed class PurchaseInvoiceEndpointsTests
{
    #region add

    [Fact]
    public async Task AddPurchaseInvoice_FirstOne_CreatesTheRemainderAndOneThatHoldsLines()
    {
        var scenario = Scenario.Build();
        var dbContext = scenario.Mock();

        await Add(scenario, dbContext);

        scenario.Shipment.PurchaseInvoices.Should().HaveCount(2,
            "a lone remainder invoice would be a column with nothing to put in it");
        scenario.Shipment.PurchaseInvoices.Select(i => i.Sequence).Should().BeEquivalentTo([1, 2]);
        scenario.Shipment.PurchaseInvoices.Should().OnlyContain(i => i.Lines.Count == 0);
        dbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AddPurchaseInvoice_Subsequent_AppendsASingleInvoice()
    {
        var scenario = Scenario.Build();
        scenario.AddInvoices(2);

        await Add(scenario, scenario.Mock());

        scenario.Shipment.PurchaseInvoices.Select(i => i.Sequence).Should().BeEquivalentTo([1, 2, 3]);
    }

    [Fact]
    public async Task AddPurchaseInvoice_DeliveredShipment_IsRejected()
    {
        var scenario = Scenario.Build(state: OutgoingShipmentState.Delivered);

        var act = async () => await Add(scenario, scenario.Mock());

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task AddPurchaseInvoice_UnknownShipment_IsNotFound()
    {
        var scenario = Scenario.Build();

        var act = async () => await AddById(scenario.Mock(), Guid.NewGuid());

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    #endregion

    #region set line

    [Fact]
    public async Task SetLine_StoresTheQuantityAndLeavesTheRestAsRemainder()
    {
        var scenario = Scenario.Build();
        var second = scenario.AddInvoices(2)[1];
        var dbContext = scenario.Mock();

        await SetLine(scenario, dbContext, second.PublicId, quantity: 4);

        second.Lines.Single().Quantity.Should().Be(4);
        scenario.RemainderOf(scenario.Product.Id).Should().Be(11, "15 bought, 4 claimed");
        dbContext.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SetLine_AboveWhatTheRunBuys_IsClampedRatherThanRejected()
    {
        // The input is capped in the UI; clamping here is the backstop that keeps the remainder
        // from going negative when something else shrank the nakládka in between.
        var scenario = Scenario.Build();
        var second = scenario.AddInvoices(2)[1];

        await SetLine(scenario, scenario.Mock(), second.PublicId, quantity: 99);

        second.Lines.Single().Quantity.Should().Be(15);
        scenario.RemainderOf(scenario.Product.Id).Should().Be(0);
    }

    [Fact]
    public async Task SetLine_ExcludesPiecesSourcedFromOurOwnStock()
    {
        var scenario = Scenario.Build();
        scenario.OrderItemA.QuantityFromInventory = 4;
        var second = scenario.AddInvoices(2)[1];

        await SetLine(scenario, scenario.Mock(), second.PublicId, quantity: 99);

        second.Lines.Single().Quantity.Should().Be(11, "4 of the 15 were bought on an earlier run");
    }

    [Fact]
    public async Task SetLine_Zero_RemovesTheLine()
    {
        var scenario = Scenario.Build();
        var second = scenario.AddInvoices(2)[1];
        await SetLine(scenario, scenario.Mock(), second.PublicId, quantity: 4);

        await SetLine(scenario, scenario.Mock(), second.PublicId, quantity: 0);

        second.Lines.Should().BeEmpty("a zero-quantity row would be indistinguishable from no claim at all");
    }

    [Fact]
    public async Task SetLine_ExistingLine_IsUpdatedNotDuplicated()
    {
        var scenario = Scenario.Build();
        var second = scenario.AddInvoices(2)[1];
        await SetLine(scenario, scenario.Mock(), second.PublicId, quantity: 4);

        await SetLine(scenario, scenario.Mock(), second.PublicId, quantity: 7);

        second.Lines.Should().ContainSingle().Which.Quantity.Should().Be(7);
    }

    [Fact]
    public async Task SetLine_TargetingTheRemainderInvoice_IsRejected()
    {
        var scenario = Scenario.Build();
        var remainder = scenario.AddInvoices(2)[0];

        var act = async () => await SetLine(scenario, scenario.Mock(), remainder.PublicId, quantity: 3);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task SetLine_ProductNotBoughtOnThisRun_IsNotFound()
    {
        var scenario = Scenario.Build();
        scenario.OrderItemA.QuantityFromInventory = scenario.OrderItemA.Quantity;
        scenario.OrderItemB.QuantityFromInventory = scenario.OrderItemB.Quantity;
        var second = scenario.AddInvoices(2)[1];

        var act = async () => await SetLine(scenario, scenario.Mock(), second.PublicId, quantity: 1);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task SetLine_DeliveredShipment_IsRejected()
    {
        var scenario = Scenario.Build(state: OutgoingShipmentState.Delivered);
        var second = scenario.AddInvoices(2)[1];

        var act = async () => await SetLine(scenario, scenario.Mock(), second.PublicId, quantity: 1);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    #endregion

    #region delete

    [Fact]
    public async Task DeletePurchaseInvoice_OfThree_ReturnsItsPiecesToTheRemainder()
    {
        var scenario = Scenario.Build();
        var invoices = scenario.AddInvoices(3);
        await SetLine(scenario, scenario.Mock(), invoices[1].PublicId, quantity: 4);
        await SetLine(scenario, scenario.Mock(), invoices[2].PublicId, quantity: 3);

        await Delete(scenario, scenario.Mock(), invoices[2].PublicId);

        scenario.Shipment.PurchaseInvoices.Should().HaveCount(2);
        scenario.RemainderOf(scenario.Product.Id).Should().Be(11, "the 3 it held are simply not claimed any more");
    }

    [Fact]
    public async Task DeletePurchaseInvoice_LastLineHolder_RemovesTheRemainderToo()
    {
        var scenario = Scenario.Build();
        var invoices = scenario.AddInvoices(2);

        await Delete(scenario, scenario.Mock(), invoices[1].PublicId);

        scenario.Shipment.PurchaseInvoices.Should().BeEmpty("a split of one is not a split, and its column has nothing to show");
    }

    [Fact]
    public async Task DeletePurchaseInvoice_CompactsTheSequencesOfTheSurvivors()
    {
        var scenario = Scenario.Build();
        var invoices = scenario.AddInvoices(3);

        await Delete(scenario, scenario.Mock(), invoices[1].PublicId);

        scenario.Shipment.PurchaseInvoices.Select(i => i.Sequence).Should().BeEquivalentTo([1, 2]);
    }

    [Fact]
    public async Task DeletePurchaseInvoice_TheRemainder_IsRejected()
    {
        var scenario = Scenario.Build();
        var invoices = scenario.AddInvoices(2);

        var act = async () => await Delete(scenario, scenario.Mock(), invoices[0].PublicId);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task DeletePurchaseInvoice_UnknownInvoice_IsNotFound()
    {
        var scenario = Scenario.Build();
        scenario.AddInvoices(2);

        var act = async () => await Delete(scenario, scenario.Mock(), Guid.NewGuid());

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    #endregion

    #region label

    [Fact]
    public async Task UpdatePurchaseInvoice_StoresATrimmedLabel()
    {
        var scenario = Scenario.Build();
        var second = scenario.AddInvoices(2)[1];

        await UpdateLabel(scenario, scenario.Mock(), second.PublicId, "  2026-0453 ");

        second.Label.Should().Be("2026-0453");
    }

    [Fact]
    public async Task UpdatePurchaseInvoice_BlankLabel_ClearsIt()
    {
        var scenario = Scenario.Build();
        var second = scenario.AddInvoices(2)[1];
        await UpdateLabel(scenario, scenario.Mock(), second.PublicId, "2026-0453");

        await UpdateLabel(scenario, scenario.Mock(), second.PublicId, "   ");

        second.Label.Should().BeNull();
    }

    #endregion

    #region helpers

    private static Task Add(Scenario scenario, Mock<AleTrackDbContext> dbContext) =>
        AddById(dbContext, scenario.ShipmentId);

    /// <summary>
    /// The endpoint takes no body and reads the shipment from the route — see the endpoint's
    /// remarks for why — so the test has to put it there.
    /// </summary>
    private static async Task AddById(Mock<AleTrackDbContext> dbContext, Guid shipmentId)
    {
        var endpoint = EndpointWithoutRequestBuilder<AddPurchaseInvoiceEndpoint>.Create(dbContext.Object);
        endpoint.HttpContext.Request.RouteValues["Id"] = shipmentId.ToString();
        await endpoint.HandleAsync(CancellationToken.None);
    }

    private static async Task SetLine(Scenario scenario, Mock<AleTrackDbContext> dbContext, Guid invoiceId, int quantity)
    {
        var endpoint = EndpointBuilder<SetPurchaseInvoiceLineRequest, SetPurchaseInvoiceLineEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new SetPurchaseInvoiceLineRequest
        {
            Id = scenario.ShipmentId,
            InvoiceId = invoiceId,
            Data = new SetPurchaseInvoiceLineDto { ProductId = scenario.Product.PublicId, Quantity = quantity }
        }, CancellationToken.None);
    }

    private static async Task Delete(Scenario scenario, Mock<AleTrackDbContext> dbContext, Guid invoiceId)
    {
        var endpoint = EndpointBuilder<DeletePurchaseInvoiceRequest, DeletePurchaseInvoiceEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new DeletePurchaseInvoiceRequest
        {
            Id = scenario.ShipmentId, InvoiceId = invoiceId
        }, CancellationToken.None);
    }

    private static async Task UpdateLabel(Scenario scenario, Mock<AleTrackDbContext> dbContext, Guid invoiceId, string? label)
    {
        var endpoint = EndpointBuilder<UpdatePurchaseInvoiceRequest, UpdatePurchaseInvoiceEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new UpdatePurchaseInvoiceRequest
        {
            Id = scenario.ShipmentId,
            InvoiceId = invoiceId,
            Data = new UpdatePurchaseInvoiceDto { Label = label }
        }, CancellationToken.None);
    }

    /// <summary>
    /// Two clients, both ordering the same product: 10 pieces and 5. Nothing is sourced from our
    /// own stock unless a test says so, so the run buys 15.
    /// </summary>
    private sealed class Scenario
    {
        internal required OutgoingShipment Shipment { get; init; }
        internal required Product Product { get; init; }
        internal required OrderItem OrderItemA { get; init; }
        internal required OrderItem OrderItemB { get; init; }
        internal Guid ShipmentId => Shipment.PublicId;

        internal int RemainderOf(long productId)
        {
            var purchased = Shipment.Stops
                .Where(s => s.ClientOrder is not null)
                .SelectMany(s => s.ClientOrder!.OrderItems)
                .Where(i => i.ProductId == productId)
                .Sum(i => i.Quantity - i.QuantityFromInventory);

            var claimed = Shipment.PurchaseInvoices
                .SelectMany(i => i.Lines)
                .Where(l => l.ProductId == productId)
                .Sum(l => l.Quantity);

            return purchased - claimed;
        }

        internal List<OutgoingShipmentPurchaseInvoice> AddInvoices(int count)
        {
            for (var i = 0; i < count; i++)
                Shipment.PurchaseInvoices.Add(new OutgoingShipmentPurchaseInvoice
                {
                    Id = Shipment.PurchaseInvoices.Count + 1,
                    PublicId = Guid.NewGuid(),
                    OutgoingShipment = Shipment,
                    Sequence = Shipment.PurchaseInvoices.Count + 1
                });

            return Shipment.PurchaseInvoices.OrderBy(i => i.Sequence).ToList();
        }

        internal Mock<AleTrackDbContext> Mock() =>
            AleTrackDbContextMockFactory.CreateMock(
                products: [Product],
                outgoingShipments: [Shipment],
                outgoingShipmentPurchaseInvoices: Shipment.PurchaseInvoices.ToList(),
                outgoingShipmentPurchaseInvoiceLines: Shipment.PurchaseInvoices.SelectMany(i => i.Lines).ToList());

        internal static Scenario Build(OutgoingShipmentState state = OutgoingShipmentState.Created)
        {
            var product = new Product
            {
                Id = 50, PublicId = Guid.NewGuid(), Name = "Albrecht 12°",
                Kind = ProductKind.Keg, PackageSize = 30, PriceWithVat = 1290m
            };

            var itemA = new OrderItem { Id = 11, PublicId = Guid.NewGuid(), Quantity = 10, ProductId = product.Id, Product = product };
            var itemB = new OrderItem { Id = 12, PublicId = Guid.NewGuid(), Quantity = 5, ProductId = product.Id, Product = product };

            var shipment = new OutgoingShipment { Id = 7, PublicId = Guid.NewGuid(), Name = "Rozvoz", State = state };

            shipment.Stops.Add(new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(), Kind = OutgoingShipmentStopKind.Order, Order = 1,
                OutgoingShipment = shipment,
                ClientOrder = new Order { Id = 101, PublicId = Guid.NewGuid(), ClientId = 1, OrderItems = [itemA] }
            });
            shipment.Stops.Add(new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(), Kind = OutgoingShipmentStopKind.Order, Order = 2,
                OutgoingShipment = shipment,
                ClientOrder = new Order { Id = 102, PublicId = Guid.NewGuid(), ClientId = 2, OrderItems = [itemB] }
            });

            return new Scenario { Shipment = shipment, Product = product, OrderItemA = itemA, OrderItemB = itemB };
        }
    }

    #endregion
}
