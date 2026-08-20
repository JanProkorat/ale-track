using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Suppliers.Commands.ReplaceOpeningHours;

/// <summary>
/// Validation rules for <see cref="ReplaceSupplierOpeningHoursRequest"/>.
/// </summary>
public sealed class ReplaceSupplierOpeningHoursValidator : Validator<ReplaceSupplierOpeningHoursRequest>
{
    public ReplaceSupplierOpeningHoursValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new ReplaceSupplierOpeningHoursDtoValidator());
    }
}

/// <summary>
/// Validation rules for the whole weekly schedule.
/// </summary>
public sealed class ReplaceSupplierOpeningHoursDtoValidator : Validator<ReplaceSupplierOpeningHoursDto>
{
    public ReplaceSupplierOpeningHoursDtoValidator()
    {
        RuleForEach(r => r.OpeningHours)
            .Must(h => h.From < h.To)
            .WithErrorCode(ErrorCodes.ValidationError)
            .WithMessage("Interval musí končit později, než začíná.");

        // Two intervals on one weekday may touch (11:30 / 12:00) but not overlap. Without
        // this, "is it open now" would pick whichever interval sorts first and report the
        // wrong closing time; the lunch-break case is exactly where that shows up.
        RuleFor(r => r.OpeningHours)
            .Must(HasNoOverlapWithinADay)
            .WithErrorCode(ErrorCodes.ValidationError)
            .WithMessage("Intervaly ve stejném dni se nesmí překrývat.");
    }

    private static bool HasNoOverlapWithinADay(List<SupplierOpeningHoursUpsertDto> hours)
    {
        foreach (var day in hours.GroupBy(h => h.DayOfWeek))
        {
            var ordered = day.OrderBy(h => h.From).ToList();

            for (var i = 1; i < ordered.Count; i++)
            {
                if (ordered[i].From < ordered[i - 1].To)
                    return false;
            }
        }

        return true;
    }
}
