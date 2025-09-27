using System.Linq.Expressions;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AleTrack.Infrastructure.Converters;

/// <summary>
/// Converter for <see cref="ICollection{T}"/> objects
/// </summary>
/// <typeparam name="TItem">Type of collection item</typeparam>
/// <remarks>
/// Convert methods will convert collection to JSON and vice versa
/// </remarks>
public sealed class DefaultListJsonConverter<TItem> : ValueConverter<List<TItem?>,string>
{
    private static readonly Expression<Func<List<TItem?>, string>> ListToJson =
        list => list.Count != 0 
            ? JsonSerializer.Serialize(list, JsonSerializerOptions.Default) 
            : "[]";
    
    private static readonly Expression<Func<string, List<TItem?>>> JsonToList =
        dgs => string.IsNullOrWhiteSpace(dgs) || dgs == "[]"
            ? new List<TItem?>()
            : JsonSerializer.Deserialize<List<TItem?>>(dgs, JsonSerializerOptions.Default) ?? new List<TItem?>();
    
    /// <summary>
    /// Constructor with defined convert methods (list => json; json => list)
    /// </summary>
    public DefaultListJsonConverter() : base(ListToJson, JsonToList)
    {}
}
