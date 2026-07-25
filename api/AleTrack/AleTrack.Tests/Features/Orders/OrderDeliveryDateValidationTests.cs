using AleTrack.Common.Utils;
using AleTrack.Features.Orders.Commands.Create;
using AleTrack.Features.Orders.Commands.Update;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.Orders;

/// <summary>
/// A delivery date in the past gets its own error code rather than the generic
/// min-value one, so the client can show a precise message instead of
/// "Request validation failed".
/// </summary>
public sealed class OrderDeliveryDateValidationTests
{
    [Fact]
    public void CreateOrderValidator_PastDeliveryDate_UsesDedicatedErrorCode()
    {
        var validator = new CreateOrderDtoValidator();

        var result = validator.Validate(OrderBuilder.BuildCreateDto(
            requiredDeliveryDate: DateOnly.FromDateTime(DateTime.Today).AddDays(-1)));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(CreateOrderDto.RequiredDeliveryDate))
            .Which.ErrorCode.Should().Be(ErrorCodes.DeliveryDateInPast);
    }

    [Fact]
    public void UpdateOrderValidator_PastDeliveryDate_UsesDedicatedErrorCode()
    {
        var validator = new UpdateOrderDtoValidator();

        var result = validator.Validate(OrderBuilder.BuildUpdateDto(
            requiredDeliveryDate: DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1)));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(UpdateOrderDto.RequiredDeliveryDate))
            .Which.ErrorCode.Should().Be(ErrorCodes.DeliveryDateInPast);
    }

    [Fact]
    public void OrderValidators_TodayIsStillRejected_ButTomorrowPasses()
    {
        var validator = new UpdateOrderDtoValidator();

        validator.Validate(OrderBuilder.BuildUpdateDto(
                requiredDeliveryDate: DateOnly.FromDateTime(DateTime.UtcNow)))
            .Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.DeliveryDateInPast);

        validator.Validate(OrderBuilder.BuildUpdateDto(
                requiredDeliveryDate: DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1)))
            .Errors.Should().NotContain(e => e.ErrorCode == ErrorCodes.DeliveryDateInPast);
    }

    [Fact]
    public void OrderValidators_NoDeliveryDate_IsAccepted()
    {
        new CreateOrderDtoValidator().Validate(OrderBuilder.BuildCreateDto(requiredDeliveryDate: null))
            .Errors.Should().NotContain(e => e.ErrorCode == ErrorCodes.DeliveryDateInPast);

        new UpdateOrderDtoValidator().Validate(OrderBuilder.BuildUpdateDto(requiredDeliveryDate: null))
            .Errors.Should().NotContain(e => e.ErrorCode == ErrorCodes.DeliveryDateInPast);
    }
}
