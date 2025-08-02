namespace AleTrack.Common.Utils;

/// <summary>
/// Error codes related to endpoints
/// </summary>
internal static class ErrorCodes
{
    /// <summary>
    /// Error code for unspecified errors
    /// </summary>
    public const string UnexpectedError = "UNEXPECTED_ERROR";
    
    /// <summary>
    /// Error code for validation errors
    /// </summary>
    public const string ValidationError = "VALIDATION_ERROR";
    
    /// <summary>
    /// Error code for case when param in request is null when it should not be
    /// </summary>
    public const string ValidationNotNullError = "VALIDATION_NOT_NULL_ERROR";
    
    /// <summary>
    /// Error code for case when param in request is empty when it should not be
    /// </summary>
    public const string ValidationNotEmptyError = "VALIDATION_NOT_EMPTY_ERROR"; 
    
    /// <summary>
    /// Error code for case when param length in request exceeded maximal allowed value
    /// </summary>
    public const string ValidationMaxLengthError = "VALIDATION_MAX_LENGTH_ERROR";

    /// <summary>
    /// Error code for case when a parameter value in a request exceeds the maximum allowed value
    /// </summary>
    public const string ValidationMaxValueExceededError = "VALIDATION_MAX_VALUE_EXCEEDED_ERROR";

    /// <summary>
    /// Error code for case when a parameter value in a request is less than the minimum allowed value
    /// </summary>
    public const string ValidationMinValueNotMatchedError = "VALIDATION_MINVALUE_NOT_MATCHED_ERROR";
    
    /// <summary>
    /// Error code for case when a requested entity is not found
    /// </summary>
    public const string NotfoundError = "ENTITY_NOT_FOUND";

    /// <summary>
    /// Error code for the case when an entity already exists
    /// </summary>
    public const string EntityAlreadyExistError = "ENTITY_ALREADY_EXISTS";
    
    /// <summary>
    /// Error code for case when property should be enum value, but is not
    /// </summary>
    public const string ValidationEnumError = "ALIDATION_NOT_ENUM_PROPERTY";
}