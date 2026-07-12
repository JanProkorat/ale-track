using System.Text.Json;
using AleTrack.Common.Models;
using FastEndpoints;
using Microsoft.AspNetCore.Diagnostics;

namespace AleTrack.Common.Utils;

/// <summary>
/// Extension defining custom exception handler
/// </summary>
public static class ExceptionHandlerExtensions
{
    /// <summary>
    /// Custom exception handler formatting error response
    /// </summary>
    /// <param name="app"></param>
    /// <param name="logger"></param>
    /// <returns></returns>
    public static IApplicationBuilder UseAleTrackExceptionHandler(this IApplicationBuilder app, Serilog.ILogger logger)
    {
        app.UseExceptionHandler(errApp =>
        {
            errApp.Run(async ctx =>
            {
                var exHandlerFeature = ctx.Features.Get<IExceptionHandlerFeature>();

                if (exHandlerFeature is not null)
                {
                    var error = exHandlerFeature.Error;

                    logger.Error(error, "Unhandled exception while handling request");

                    var response = GetStatusCode(error);
                    ctx.Response.StatusCode = response.statusCode;
                    ctx.Response.ContentType = "application/problem+json";
                    await ctx.Response.WriteAsJsonAsync(
                        new FailureResponse(response.message, response.errorCode, response.errorProperties));
                }
            });
        });

        return app;
    }

    private static (int statusCode, string message, string errorCode, string type, IDictionary<string, object>? errorProperties) GetStatusCode(Exception exception)
    {
        int responseStatusCode;
        var message = exception.Message;
        IDictionary<string, object>? errorProperties = null;
        var errorCode = ErrorCodes.UnexpectedError;
        var type = exception.GetType().Name;
        switch (exception)
        {
            case AleTrackException  aleTrackException:
                responseStatusCode = aleTrackException.StatusCode;
                message = aleTrackException.Message;
                errorCode = aleTrackException.ErrorCode;
                errorProperties = aleTrackException.ErrorProperties;
                break;
            case ValidationFailureException validationException:
                responseStatusCode = validationException.StatusCode ?? StatusCodes.Status400BadRequest;
                message = validationException.Message.Split(" - ")[0];
                errorCode = ErrorCodes.ValidationError;
                errorProperties = validationException.Failures
                    .Select(x => new
                    {
                        Key = x.PropertyName,
                        Value = new ValidationErrorDto
                        {
                            ErrorCode = x.ErrorCode,
                            ErrorMessage = x.ErrorMessage
                        }
                    })
                    .ToDictionary(
                        group => group.Key,
                        group => group.Value as object
                    );
                break;
            case JsonException jsonException:
                responseStatusCode = StatusCodes.Status400BadRequest;
                var errorProperty = jsonException.Path?.Split("$.")[1];
                message = $"{errorProperty} cannot be null";
                errorCode = ErrorCodes.ValidationNotNullError;
                type = nameof(JsonException);
                errorProperties = new Dictionary<string, object>
                {
                    { nameof(errorProperty), errorProperty },
                };
                break;
            default:
                responseStatusCode = StatusCodes.Status500InternalServerError;
                break;
        }

        return (responseStatusCode, message, errorCode, type, errorProperties);
    }
}

