namespace AleTrack.Common.Enums;

/// <summary>
/// States of order item reminder
/// </summary>
public enum OrderItemReminderState
{
    /// <summary>
    /// For case when a reminder was added
    /// </summary>
    Added = 0,
    
    /// <summary>
    /// For case when a reminder was resolved
    /// </summary>
    Resolved = 1
}