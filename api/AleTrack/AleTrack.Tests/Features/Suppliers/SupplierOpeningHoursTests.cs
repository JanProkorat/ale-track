using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Suppliers.Commands.ReplaceOpeningHours;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Suppliers;

public sealed class ReplaceSupplierOpeningHoursTests
{
    private static ReplaceSupplierOpeningHoursRequest Request(Guid id, params SupplierOpeningHoursUpsertDto[] hours)
        => new() { Id = id, Data = new ReplaceSupplierOpeningHoursDto { OpeningHours = hours.ToList() } };

    [Fact]
    public async Task ProcessAsync_ReplaceHours_StoresLunchBreakAsTwoIntervals()
    {
        var supplierId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var command = Request(supplierId,
            SupplierBuilder.BuildHoursDto(DayOfWeek.Monday, "07:00", "11:30"),
            SupplierBuilder.BuildHoursDto(DayOfWeek.Monday, "12:00", "15:30"));

        var endpoint = EndpointBuilder<ReplaceSupplierOpeningHoursRequest, ReplaceSupplierOpeningHoursEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        supplier.OpeningHours.Should().HaveCount(2);
        supplier.OpeningHours.Should().OnlyContain(h => h.DayOfWeek == DayOfWeek.Monday);
        supplier.OpeningHours[0].To.Should().Be(new TimeOnly(11, 30));
        supplier.OpeningHours[1].From.Should().Be(new TimeOnly(12, 0));
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// Stored sorted, so every reader sees the week in grid order without re-sorting.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_ReplaceHours_SortsByDayThenStart()
    {
        var supplierId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var command = Request(supplierId,
            SupplierBuilder.BuildHoursDto(DayOfWeek.Friday, "07:00", "13:00"),
            SupplierBuilder.BuildHoursDto(DayOfWeek.Monday, "12:00", "15:30"),
            SupplierBuilder.BuildHoursDto(DayOfWeek.Monday, "07:00", "11:30"));

        var endpoint = EndpointBuilder<ReplaceSupplierOpeningHoursRequest, ReplaceSupplierOpeningHoursEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        supplier.OpeningHours.Select(h => (h.DayOfWeek, h.From.Hour)).Should().Equal(
            (DayOfWeek.Monday, 7),
            (DayOfWeek.Monday, 12),
            (DayOfWeek.Friday, 7));
    }

    [Fact]
    public async Task ProcessAsync_ReplaceHours_EmptyListClearsTheWeek()
    {
        var supplierId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(
            publicId: supplierId,
            openingHours: [SupplierBuilder.BuildHours(DayOfWeek.Monday, "07:00", "15:00")]);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var endpoint = EndpointBuilder<ReplaceSupplierOpeningHoursRequest, ReplaceSupplierOpeningHoursEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(Request(supplierId), CancellationToken.None);

        supplier.OpeningHours.Should().BeEmpty();
    }

    [Fact]
    public async Task ProcessAsync_ReplaceHours_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointBuilder<ReplaceSupplierOpeningHoursRequest, ReplaceSupplierOpeningHoursEndpoint>
            .Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(Request(Guid.NewGuid()), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}

/// <summary>
/// The interval rules live in the validator, so they are tested there rather than through the
/// endpoint — that is also where a bad request is actually rejected.
/// </summary>
public sealed class ReplaceSupplierOpeningHoursValidatorTests
{
    private static ReplaceSupplierOpeningHoursDtoValidator Validator() => new();

    private static ReplaceSupplierOpeningHoursDto Dto(params SupplierOpeningHoursUpsertDto[] hours)
        => new() { OpeningHours = hours.ToList() };

    [Fact]
    public void Validate_TouchingIntervals_AreAllowed()
    {
        var result = Validator().Validate(Dto(
            SupplierBuilder.BuildHoursDto(DayOfWeek.Monday, "07:00", "11:30"),
            SupplierBuilder.BuildHoursDto(DayOfWeek.Monday, "11:30", "15:30")));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_OverlappingIntervalsOnTheSameDay_AreRejected()
    {
        var result = Validator().Validate(Dto(
            SupplierBuilder.BuildHoursDto(DayOfWeek.Monday, "07:00", "12:00"),
            SupplierBuilder.BuildHoursDto(DayOfWeek.Monday, "11:30", "15:30")));

        result.IsValid.Should().BeFalse();
    }

    /// <summary>
    /// The same clock times on different weekdays are not an overlap — the grouping has to be
    /// per day, which a naive pairwise check would get wrong.
    /// </summary>
    [Fact]
    public void Validate_SameTimesOnDifferentDays_AreAllowed()
    {
        var result = Validator().Validate(Dto(
            SupplierBuilder.BuildHoursDto(DayOfWeek.Monday, "07:00", "15:30"),
            SupplierBuilder.BuildHoursDto(DayOfWeek.Tuesday, "07:00", "15:30")));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_IntervalEndingBeforeItStarts_IsRejected()
    {
        var result = Validator().Validate(Dto(SupplierBuilder.BuildHoursDto(DayOfWeek.Monday, "15:00", "07:00")));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_ZeroLengthInterval_IsRejected()
    {
        var result = Validator().Validate(Dto(SupplierBuilder.BuildHoursDto(DayOfWeek.Monday, "07:00", "07:00")));

        result.IsValid.Should().BeFalse();
    }

    /// <summary>
    /// A nonstop point: the whole day in one interval, ending 23:59 because neither TimeOnly
    /// nor an HTML time input can express 24:00.
    /// </summary>
    [Fact]
    public void Validate_WholeDayInterval_IsAllowed()
    {
        var result = Validator().Validate(Dto(SupplierBuilder.BuildHoursDto(DayOfWeek.Sunday, "00:00", "23:59")));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_EmptyWeek_IsAllowed()
    {
        Validator().Validate(Dto()).IsValid.Should().BeTrue();
    }
}
