using System.Linq.Expressions;
using System.Reflection;

namespace AleTrack.Common.Utils;

/// <summary>
/// Provides extension methods for IQueryable collections to allow filtering and sorting capabilities.
/// </summary>
public static class QueryableExtensions
{
    private const string DescSortDirection = "desc";

    public static IQueryable<T> ApplyFilterAndSort<T>(this IQueryable<T> query, Dictionary<string, string>? queryParams)
    {
        if (queryParams is null)
            return query;

        var filterParameters = queryParams
            .Where(p => p.Key != "sort")
            .ToDictionary();

        if (filterParameters.Count > 0)
            query = query.ApplyFilter(filterParameters);
        
        var sortParameters = queryParams
            .Where(p => p.Key == "sort")
            .Select(p => p.Value)
            .ToList();

        if (sortParameters.Count > 0)
            query = query.ApplySort(sortParameters);

        return query;
    }
    
    /// <summary>
    /// Applies filtering to the provided queryable collection based on the specified filters.
    /// </summary>
    /// <typeparam name="T">The type of the elements in the queryable collection.</typeparam>
    /// <param name="query">The queryable collection to which the filters are applied.</param>
    /// <param name="filters">A dictionary containing filter keys (property paths) and their corresponding filter values.</param>
    /// <returns>A queryable collection that has been filtered according to the specified filters.</returns>
    private static IQueryable<T> ApplyFilter<T>(this IQueryable<T> query, Dictionary<string, string>? filters)
    {
        if (filters is null || filters.Count is 0)
            return query;

        // Parameter for lambda expression
        var parameter = Expression.Parameter(typeof(T), "x");
        Expression? finalExpression = null;

        foreach (var (propertyPath, filterValue) in filters)
        {
            // Parse operator and value
            var parsedValues = ParseFilterValue(filterValue);
            if (parsedValues is null)
                continue;
            
            var operatorType = parsedValues.Item1;
            var value = parsedValues.Item2;
            
            // Create expression for the property
            var propertyExpr = GetPropertyExpression(parameter, propertyPath);

            if (propertyExpr is null)
                continue;

            // Create comparison expression
            var comparison = CreateComparisonExpression(propertyExpr, operatorType, value);

            if (comparison == null)
                continue;

            // Combine expressions using AND
            finalExpression = finalExpression == null
                ? comparison
                : Expression.AndAlso(finalExpression, comparison);
        }

        if (finalExpression == null)
            return query;

        // Create lambda expression
        var lambda = Expression.Lambda<Func<T, bool>>(finalExpression, parameter);

        // Apply filter
        return query.Where(lambda);
    }

    /// <summary>
    /// Applies sorting to the provided queryable collection based on the specified sorting parameters.
    /// </summary>
    /// <typeparam name="T">The type of the elements in the queryable collection.</typeparam>
    /// <param name="query">The queryable collection to which the sorting is applied.</param>
    /// <param name="sortParameters">A collection of sorting parameters, where each parameter specifies a property path and an optional sorting direction (e.g., ascending or descending).</param>
    /// <returns>A queryable collection that has been sorted according to the specified sorting parameters.</returns>
    private static IQueryable<T> ApplySort<T>(this IQueryable<T> query, IEnumerable<string>? sortParameters)
    {
        if (sortParameters is null || !sortParameters.Any())
            return query;

        var result = query;
        var isFirst = true;

        foreach (var sortParam in sortParameters)
        {
            if (string.IsNullOrWhiteSpace(sortParam))
                continue;

            // Parse sort parameter
            var sortInfo = ParseSortParameter(sortParam);
            if (sortInfo == null)
                continue;

            // Apply sorting with information whether it's first or subsequent
            result = ApplySortCore(result, sortInfo.Value.propertyPath, sortInfo.Value.isDescending, isFirst);
            isFirst = false;
        }

        return result;
    }

    /// <summary>
    /// Parses a filter value string into its operator type and value components.
    /// </summary>
    /// <param name="filterValue">The filter value string in the format "operator:value".</param>
    /// <returns>A tuple containing the operator type as the first element and the value as the second element.</returns>
    private static Tuple<string, string>? ParseFilterValue(string filterValue)
    {
        // Format: "op:value"
        var parts = filterValue.Split([':'], 2);
        if (parts.Length is not 2)
            return null; 

        return new Tuple<string, string>(parts[0].ToLower(), parts[1]);
    }

    /// <summary>
    /// Parses a sort parameter string to extract the property path and sort direction.
    /// </summary>
    /// <param name="sortParameter">
    /// The sort parameter string in the format "direction:property", where "direction" specifies
    /// the sort order (e.g., "asc" or "desc") and "property" is the name of the property by which
    /// to sort.
    /// </param>
    /// <returns>
    /// A tuple containing the property path and a boolean indicating whether the sort direction
    /// is descending, or null if the sort parameter is invalid.
    /// </returns>
    private static (string propertyPath, bool isDescending)? ParseSortParameter(string sortParameter)
    {
        // Format: direction:property
        var parts = sortParameter.Split(':');
        if (parts.Length is not 2)
            return null;

        var direction = parts[0].ToLower();
        var propertyPath = parts[1];

        // Check if descending order
        var isDescending = direction is DescSortDirection;

        return (propertyPath, isDescending);
    }

    /// <summary>
    /// Applies sorting to the provided queryable collection based on the specified property path, sorting direction, and whether it is the first sorting operation.
    /// </summary>
    /// <typeparam name="T">The type of the elements in the queryable collection.</typeparam>
    /// <param name="query">The queryable collection to which the sorting is applied.</param>
    /// <param name="propertyPath">The property path used for sorting, including nested properties.</param>
    /// <param name="isDescending">Indicates whether the sorting should be in descending order.</param>
    /// <param name="isFirst">Indicates whether this is the first sorting operation applied to the queryable collection.</param>
    /// <returns>A queryable collection that has been sorted according to the specified parameters.</returns>
    private static IQueryable<T> ApplySortCore<T>(
        IQueryable<T> query,
        string propertyPath,
        bool isDescending,
        bool isFirst)
    {
        // Process property path (including nested objects)
        var parameter = Expression.Parameter(typeof(T), "x");

        // Get property expression
        var propertyExpr = GetPropertyExpression(parameter, propertyPath);

        if (propertyExpr is null)
            return query; // If property doesn't exist, return original query

        // Convert string properties to lower case for case-insensitive sorting
        if (propertyExpr.Type == typeof(string))
        {
            var toLowerMethod = typeof(string).GetMethod("ToLower", Type.EmptyTypes);
            propertyExpr = Expression.Call(propertyExpr, toLowerMethod!);
        }

        // Create lambda expression for sorting
        var lambdaExpr = Expression.Lambda(propertyExpr, parameter);

        // Select appropriate method for sorting based on whether it's first or subsequent, and direction
        string methodName;
        if (isFirst)
        {
            methodName = isDescending ? "OrderByDescending" : "OrderBy";
        }
        else
        {
            methodName = isDescending ? "ThenByDescending" : "ThenBy";
        }

        // Create method call
        var methodCall = Expression.Call(
            typeof(Queryable),
            methodName,
            new[] { typeof(T), propertyExpr.Type },
            query.Expression,
            Expression.Quote(lambdaExpr)
        );

        return query.Provider.CreateQuery<T>(methodCall);
    }

    /// <summary>
    /// Constructs an expression to access a property, including support for nested properties, from a parameter expression.
    /// </summary>
    /// <param name="parameter">The parameter expression representing the object from which the property will be accessed.</param>
    /// <param name="propertyPath">The path to the property, supporting nested properties separated by '|'.</param>
    /// <returns>An expression that represents the access to the specified property, or null if the property does not exist.</returns>
    private static Expression? GetPropertyExpression(ParameterExpression parameter, string propertyPath)
    {
        // Process path to property, including nested objects (address|city)
        var parts = propertyPath.Split('|');
        Expression propertyExpr = parameter;

        foreach (var part in parts)
        {
            var property = propertyExpr.Type.GetProperty(part, BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

            if (property == null)
                return null;

            propertyExpr = Expression.Property(propertyExpr, property);
        }

        return propertyExpr;
    }

    /// <summary>
    /// Creates a comparison expression for a property based on the specified operator and value.
    /// </summary>
    /// <param name="propertyExpr">An expression representing the property to compare.</param>
    /// <param name="operatorType">The type of comparison operator to use (e.g., "eq", "gt", "contains").</param>
    /// <param name="value">The value to compare the property against.</param>
    /// <returns>A comparison expression if the operator and value are valid; otherwise, null.</returns>
    private static Expression? CreateComparisonExpression(Expression propertyExpr, string operatorType, string value)
    {
        // Convert value to correct type
        var propertyType = propertyExpr.Type;
        object typedValue;

        try
        {
            typedValue = ConvertValue(value, propertyType);
        }
        catch
        {
            return null; // If conversion fails, skip this filter
        }

        // Constant expression
        var valueExpr = Expression.Constant(typedValue, propertyType);

        // Create expression based on operator
        switch (operatorType)
        {
            case "eq": // equals
                return Expression.Equal(propertyExpr, valueExpr);

            case "neq": // not equals
                return Expression.NotEqual(propertyExpr, valueExpr);

            case "gt": // greater than
                return Expression.GreaterThan(propertyExpr, valueExpr);

            case "gte": // greater than or equal
                return Expression.GreaterThanOrEqual(propertyExpr, valueExpr);

            case "lt": // less than
                return Expression.LessThan(propertyExpr, valueExpr);

            case "lte": // less than or equal
                return Expression.LessThanOrEqual(propertyExpr, valueExpr);

            case "contains":
                if (propertyType == typeof(string))
                {
                    var containsMethod = typeof(string).GetMethod("Contains", new[] { typeof(string) });
                    var toLower = typeof(string).GetMethod("ToLower", Type.EmptyTypes)!;
                    var lowerProperty = Expression.Call(propertyExpr, toLower);
                    var lowerValue = Expression.Constant(value.ToLower());
                    return Expression.Call(lowerProperty, containsMethod, lowerValue);
                }

                return null;

            case "startswith":
                if (propertyType == typeof(string))
                {
                    var startsWithMethod = typeof(string).GetMethod("StartsWith", new[] { typeof(string) });
                    var toLower = typeof(string).GetMethod("ToLower", Type.EmptyTypes)!;
                    var lowerProperty = Expression.Call(propertyExpr, toLower);
                    var lowerValue = Expression.Constant(value.ToLower());
                    return Expression.Call(lowerProperty, startsWithMethod, lowerValue);
                }

                return null;

            case "endswith":
                if (propertyType == typeof(string))
                {
                    var endsWithMethod = typeof(string).GetMethod("EndsWith", new[] { typeof(string) });
                    var toLower = typeof(string).GetMethod("ToLower", Type.EmptyTypes)!;
                    var lowerProperty = Expression.Call(propertyExpr, toLower);
                    var lowerValue = Expression.Constant(value.ToLower());
                    return Expression.Call(lowerProperty, endsWithMethod, lowerValue);
                }

                return null;

            default:
                return Expression.Equal(propertyExpr, valueExpr); // Default operation is equals
        }
    }

    /// <summary>
    /// Converts the provided string value to the specified target type.
    /// </summary>
    /// <param name="value">The string value to be converted.</param>
    /// <param name="targetType">The target type to which the value should be converted.</param>
    /// <returns>An object of the specified target type that represents the converted value.</returns>
    private static object? ConvertValue(string value, Type targetType)
    {
        // Handle null value
        if (string.IsNullOrEmpty(value) && targetType.IsClass)
            return null;

        // Handle Nullable types
        var underlyingType = Nullable.GetUnderlyingType(targetType);
        if (underlyingType is not null)
        {
            if (string.IsNullOrEmpty(value))
                return null;

            targetType = underlyingType;
        }

        // Special handling for certain types
        if (targetType == typeof(Guid))
            return Guid.Parse(value);

        if (targetType == typeof(DateTime))
            return DateTime.Parse(value);
        
        if (targetType == typeof(DateOnly))
            return DateOnly.Parse(value);

        if (targetType == typeof(bool) && (value == "1" || value == "0"))
            return value == "1";

        // General conversion
        return Convert.ChangeType(value, targetType);
    }
}