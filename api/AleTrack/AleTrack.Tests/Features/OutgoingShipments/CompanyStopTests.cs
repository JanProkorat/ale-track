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
    [Fact]
    public async Task HandleAsync_CompanyStopInRequest_PersistsCompanyAddressNotTheClientsClaim()
    {
        var (shipment, request, dbContext) = Arrange(OutgoingShipmentState.Created, []);

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
