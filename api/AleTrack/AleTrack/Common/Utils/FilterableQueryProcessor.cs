using AleTrack.Common.Models;
using FastEndpoints;
using NSwag;
using NSwag.Generation.AspNetCore;
using NSwag.Generation.Processors;
using NSwag.Generation.Processors.Contexts;

namespace AleTrack.Common.Utils;

/// <summary>
/// Processor for handling <see cref="FilterableRequest"/>s
/// </summary>
public sealed class FilterableQueryProcessor : IOperationProcessor
{
    /// <inheritdoc />
    public bool Process(OperationProcessorContext context)
    {
        if (context is not AspNetCoreOperationProcessorContext aspNetContext) 
            return true;

        var endpointDefinition = aspNetContext.ApiDescription.ActionDescriptor.EndpointMetadata
            .OfType<EndpointDefinition>()
            .FirstOrDefault();

        if (endpointDefinition is null || !endpointDefinition.ReqDtoType.IsAssignableTo(typeof(FilterableRequest)))
            return true;

        foreach (var operationParameter in context.OperationDescription.Operation.Parameters)
        {
            if (operationParameter.Name != nameof(FilterableRequest.Parameters) ||
                operationParameter.Kind != OpenApiParameterKind.Query) 
                continue;
            
            operationParameter.Example = new
            {
                age = "gt:33", 
                users = "in:john,jane"
            };
            break;
        }
        
        return true;
    }
}
