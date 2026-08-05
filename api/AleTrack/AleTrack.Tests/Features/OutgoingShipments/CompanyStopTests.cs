using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;
using FluentValidation.TestHelper;
using Microsoft.Extensions.Options;
using static AleTrack.Tests.Features.OutgoingShipments.OutgoingShipmentTestHelpers;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The warehouse stop: server-authored coordinates, and a content diff that can
/// actually see it.
/// </summary>
public sealed class CompanyStopTests
{
    /// <summary>
    /// The label and coordinates are the server's to write. A stale — or hostile —
    /// client must not be able to pin the warehouse stop somewhere else.
    /// </summary>
    /// <remarks>
    /// The shipment carries a stock purchase so the Company stop is legitimate under
    /// <see cref="CompanyStopReconciler"/>'s invariant — without one, the reconciler would
    /// strip the stop entirely rather than leave it for the client's claim to be checked.
    /// </remarks>
    [Fact]
    public async Task HandleAsync_CompanyStopInRequest_PersistsCompanyAddressNotTheClientsClaim()
    {
        var (shipment, request, dbContext) = Arrange(OutgoingShipmentState.Created, []);

        var product = ProductBuilder.BuildEntity();
        var stockPurchaseId = Guid.NewGuid();
        shipment.StockPurchases.Add(new OutgoingShipmentStockPurchaseItem
        {
            PublicId = stockPurchaseId,
            Product = product,
            ProductId = product.Id,
            Quantity = 6
        });

        request.Data.CustomStops =
        [
            new CustomStopDto
            {
                Kind = OutgoingShipmentStopKind.Company,
                Order = 2,
                Label = "Někde jinde",
                Latitude = 0m,
                Longitude = 0m
            }
        ];
        request.Data.StockPurchases =
        [
            new StockPurchaseDto
            {
                Id = stockPurchaseId,
                ProductId = product.PublicId,
                Quantity = 6
            }
        ];

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, Options.Create(Company));

        await endpoint.HandleAsync(request, CancellationToken.None);

        var stored = shipment.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Company);
        stored.Label.Should().Be("AleTrack s.r.o.");
        stored.Latitude.Should().Be(50.7663m);
        stored.Longitude.Should().Be(15.0543m);
    }

    [Fact]
    public async Task HandleAsync_TwoCompanyStops_FailsValidation()
    {
        var dto = OutgoingShipmentBuilder.BuildUpdateDto();
        dto.CustomStops =
        [
            new CustomStopDto { Kind = OutgoingShipmentStopKind.Company, Order = 1 },
            new CustomStopDto { Kind = OutgoingShipmentStopKind.Company, Order = 2 }
        ];

        var result = new UpdateOutgoingShipmentDtoValidator().TestValidate(dto);

        result.ShouldHaveValidationErrorFor(d => d.CustomStops);
    }

    /// <summary>
    /// The regression this task exists to prevent: with a Company stop on the run,
    /// re-sending the shipment unchanged must not read as changed content, or
    /// advancing the state becomes impossible.
    /// </summary>
    [Fact]
    public void ChangedFrozenFields_UnchangedRequestWithACompanyStop_ReturnsEmpty()
    {
        var (shipment, dto) = RoundTrippedWithCompanyStop();

        dto.State = OutgoingShipmentState.InTransit;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEmpty();
    }

    [Fact]
    public void ChangedFrozenFields_CompanyStopMoved_ReportsCustomStops()
    {
        var (shipment, dto) = RoundTrippedWithCompanyStop();

        dto.CustomStops[0].Order = 99;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.CustomStops));
    }

    /// <summary>
    /// A payload that omits <see cref="CustomStopDto.Kind"/> and
    /// <see cref="UpdateOutgoingShipmentDto.StartPointKind"/> is not the same shipment,
    /// whatever the caller intended — both fields fall back to their DTO defaults
    /// (Custom, Company) and describe a run that starts at the depot with the warehouse
    /// stop demoted to an ordinary custom one.
    /// </summary>
    /// <remarks>
    /// A regression guard, not a change: this is the backend correctly refusing a
    /// client that does not round-trip the two fields. A frontend defect of exactly
    /// that shape reached review, and the guard is the thing that caught it — the
    /// symptom was "Vyrazit" failing with ShipmentContentFrozen on any run with a
    /// brewery origin or a warehouse stop. Loosening either comparison to make such a
    /// payload pass would trade a loud failure for silent data loss.
    /// </remarks>
    [Fact]
    public void ChangedFrozenFields_RequestOmittingStopKindAndStartPoint_ReportsBoth()
    {
        var (shipment, dto) = RoundTrippedWithCompanyStop();

        dto.CustomStops[0].Kind = OutgoingShipmentStopKind.Custom;
        dto.StartPointKind = ShipmentStartPointKind.Company;
        dto.StartBreweryId = null;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEquivalentTo([
            nameof(UpdateOutgoingShipmentDto.CustomStops),
            nameof(UpdateOutgoingShipmentDto.StartPointKind)
        ]);
    }

    /// <summary>
    /// Builds on <see cref="OutgoingShipmentTestHelpers.RoundTripped"/> by adding a stored
    /// Company stop and its matching DTO — but the incoming side carries blank label and
    /// zeroed coordinates, exactly what a client that does not preserve server-authored
    /// fields would round-trip. Without normalizing those fields before comparing, this
    /// alone would read as changed content.
    /// </summary>
    private static (OutgoingShipment Shipment, UpdateOutgoingShipmentDto Dto) RoundTrippedWithCompanyStop()
    {
        var (shipment, dto) = RoundTripped();

        var companyStop = new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Company,
            Order = 0,
            Label = Company.Name,
            Latitude = Company.Latitude,
            Longitude = Company.Longitude
        };
        shipment.Stops.Add(companyStop);

        dto.CustomStops.Insert(0, new CustomStopDto
        {
            Id = companyStop.PublicId,
            Kind = OutgoingShipmentStopKind.Company,
            Order = 0,
            Label = string.Empty,
            Latitude = 0m,
            Longitude = 0m
        });

        return (shipment, dto);
    }
}
