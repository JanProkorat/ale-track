using System.Text;
using AleTrack.Common.Utils;
using AleTrack.Features.Breweries.Commands.ApplyPriceList;
using AleTrack.Features.Breweries.Commands.PreviewPriceList;
using FastEndpoints;
using FluentAssertions;
using FluentValidation.Results;
using FluentValidation.TestHelper;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// Multipart binding for the price-list endpoints, driven through the framework's own binder.
/// </summary>
/// <remarks>
/// The other endpoint tests call <c>HandleAsync</c> directly, which skips binding entirely — so the
/// one part of an upload nothing else exercises is whether the file and the form fields arrive at
/// all. These are the only endpoints in the codebase that take a file, so the binding path has no
/// other coverage.
/// </remarks>
public sealed class PriceListBindingTests
{
    private static DefaultHttpContext MultipartRequest(
        Guid breweryId, IDictionary<string, StringValues> fields, bool withFile = true)
    {
        var bytes = Encoding.UTF8.GetBytes("name,type\n");
        var files = withFile
            ? new FormFileCollection { new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "list.csv") }
            : [];

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Method = "POST";
        httpContext.Request.ContentType = "multipart/form-data; boundary=x";
        httpContext.Request.RouteValues["Id"] = breweryId.ToString();
        httpContext.Request.Form = new FormCollection(new Dictionary<string, StringValues>(fields), files);

        return httpContext;
    }

    private static async Task<(TRequest Request, List<ValidationFailure> Failures)> BindAsync<TRequest>(
        DefaultHttpContext httpContext) where TRequest : notnull
    {
        var failures = new List<ValidationFailure>();
        var request = await new RequestBinder<TRequest>()
            .BindAsync(new BinderContext(httpContext, failures, null, false, []), default);

        return (request, failures);
    }

    [Theory]
    // What the generated client actually puts on the wire for a form field: Date.toJSON().
    [InlineData("2026-08-11T12:30:14.076Z", 2026, 8, 11)]
    [InlineData("2026-05-01T00:00:00.000Z", 2026, 5, 1)]
    // …and the plain form it uses inside a JSON body.
    [InlineData("2026-05-01", 2026, 5, 1)]
    public void ParseDateOnly_AcceptsBothWireFormsTheClientProduces(
        string raw, int year, int month, int day)
    {
        // The first of these is the exact value that failed in the browser: NSwag formats a
        // date-only value as yyyy-MM-dd only inside a JSON body, and calls Date.toJSON() for a
        // form field. Nothing else in this codebase sends a date that way, so nothing caught it.
        var result = DateOnlyValueParser.Parse(raw);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(new DateOnly(year, month, day));
    }

    [Fact]
    public void ParseDateOnly_TakesTheUtcDateSoAPickedDayIsNotShiftedBackwards()
    {
        // The client sends UTC midnight for the day the user picked. Reading the instant in local
        // time instead would land on the previous day everywhere east of UTC.
        DateOnlyValueParser.Parse("2026-08-11T00:00:00.000Z").Value
            .Should().Be(new DateOnly(2026, 8, 11));
    }

    [Fact]
    public void ParseDateOnly_RejectsWhatIsNotADate()
    {
        DateOnlyValueParser.Parse("not a date").IsSuccess.Should().BeFalse();
        DateOnlyValueParser.Parse(StringValues.Empty).IsSuccess.Should().BeFalse();
        DateOnlyValueParser.Parse("").IsSuccess.Should().BeFalse();
    }

    [Fact]
    public async Task Bind_PreviewUpload_CarriesTheFileTheDateAndTheRouteId()
    {
        var breweryId = Guid.NewGuid();

        var (request, failures) = await BindAsync<PreviewPriceListRequest>(
            MultipartRequest(breweryId, new Dictionary<string, StringValues>
            {
                ["effectiveFrom"] = "2026-05-01"
            }));

        failures.Should().BeEmpty();
        request.Id.Should().Be(breweryId);
        request.File.Should().NotBeNull();
        request.File.FileName.Should().Be("list.csv");
        request.EffectiveFrom.Should().Be(new DateOnly(2026, 5, 1));
    }

    [Fact]
    public async Task Bind_TheDateFormatTheClientActuallySends_NeedsTheRegisteredParser()
    {
        // Reproduces the failure seen in the browser, and pins where the fix has to live: the stock
        // binder rejects an ISO instant outright, which is why Program.cs registers
        // DateOnlyValueParser. The registration is global runtime config rather than something the
        // binder accepts as an argument, so this test cannot apply it — it asserts the behaviour
        // that makes the registration necessary. If FastEndpoints ever parses this natively, this
        // fails and the parser can be reconsidered.
        var act = async () => await BindAsync<PreviewPriceListRequest>(
            MultipartRequest(Guid.NewGuid(), new Dictionary<string, StringValues>
            {
                ["effectiveFrom"] = "2026-08-11T12:30:14.076Z"
            }));

        (await act.Should().ThrowAsync<ValidationFailureException>())
            .WithMessage("*is not valid for a [DateOnly] property*");
    }

    [Fact]
    public async Task Bind_ApplyUpload_AlsoCarriesTheSourceHash()
    {
        // The hash is what ties an apply to the diff the user reviewed. Losing it in binding would
        // turn every apply into a 409 — or, if it bound to empty, defeat the check entirely.
        var breweryId = Guid.NewGuid();

        var (request, failures) = await BindAsync<ApplyPriceListRequest>(
            MultipartRequest(breweryId, new Dictionary<string, StringValues>
            {
                ["effectiveFrom"] = "2026-05-01",
                ["sourceHash"] = "9f2b7c"
            }));

        failures.Should().BeEmpty();
        request.Id.Should().Be(breweryId);
        request.File.Should().NotBeNull();
        request.EffectiveFrom.Should().Be(new DateOnly(2026, 5, 1));
        request.SourceHash.Should().Be("9f2b7c");
    }

    [Fact]
    public async Task Bind_UploadWithoutAnEffectiveDate_LeavesItAtTheDefaultRatherThanFailing()
    {
        // Documents why the validators below exist: a missing form field is not a binding error,
        // so nothing but a rule stops an import being recorded as effective 0001-01-01.
        var (request, failures) = await BindAsync<ApplyPriceListRequest>(
            MultipartRequest(Guid.NewGuid(), new Dictionary<string, StringValues>
            {
                ["sourceHash"] = "9f2b7c"
            }));

        failures.Should().BeEmpty();
        request.EffectiveFrom.Should().Be(default);
    }

    [Fact]
    public void Validate_PreviewWithoutAnEffectiveDate_IsRejected()
    {
        var result = new PreviewPriceListValidator().TestValidate(new PreviewPriceListRequest
        {
            Id = Guid.NewGuid(),
            File = new FormFile(new MemoryStream([]), 0, 0, "file", "list.csv")
        });

        result.ShouldHaveValidationErrorFor(r => r.EffectiveFrom)
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);
    }

    [Fact]
    public void Validate_ApplyWithoutASourceHash_IsRejected()
    {
        // Absent it would compare unequal and surface as a conflict, telling the caller the file
        // changed when the request was simply malformed.
        var result = new ApplyPriceListValidator().TestValidate(new ApplyPriceListRequest
        {
            Id = Guid.NewGuid(),
            File = new FormFile(new MemoryStream([]), 0, 0, "file", "list.csv"),
            EffectiveFrom = new DateOnly(2026, 5, 1),
            SourceHash = string.Empty
        });

        result.ShouldHaveValidationErrorFor(r => r.SourceHash)
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);
    }

    [Fact]
    public void Validate_AWellFormedApply_Passes()
    {
        var result = new ApplyPriceListValidator().TestValidate(new ApplyPriceListRequest
        {
            Id = Guid.NewGuid(),
            File = new FormFile(new MemoryStream([]), 0, 0, "file", "list.csv"),
            EffectiveFrom = new DateOnly(2026, 5, 1),
            SourceHash = "9f2b7c"
        });

        result.ShouldNotHaveAnyValidationErrors();
    }
}
