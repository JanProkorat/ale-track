using FastEndpoints;
using NSwag.Generation.Processors;
using NSwag.Generation.Processors.Contexts;

namespace AleTrack.Common.Utils;

internal sealed class BadRequestResponseProcessor : IOperationProcessor
{
    private readonly string _badRequestStatusCode = StatusCodes.Status400BadRequest.ToString();
    public bool Process(OperationProcessorContext context)
    {
        if (!context.OperationDescription.Operation.Responses.TryGetValue(_badRequestStatusCode,
                out var badRequestResponse)) return true;
        
        badRequestResponse.Content.Remove("application/problem+json");
        badRequestResponse.SetFailureResponse<ValidationFailureException>(new Dictionary<string, object>
        {
            { "validatedProp1", "validation problem" },
            { "validatedProp2", "validation problem" },
            { "validatedProp3", "validation problem" }
        });

        return true;
    }
}
