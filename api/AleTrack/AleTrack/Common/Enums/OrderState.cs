using AleTrack.Entities;

namespace AleTrack.Common.Enums;

/// <summary>
/// State of related <see cref="Order"/>
/// </summary>
public enum OrderState
{
    /// <summary>
    /// Represents the initial state of an order where it has been created but no further processes have started.
    /// </summary>
    New = 0,
    
    /// <summary>
    /// State when order was added to planned client delivery
    /// </summary>
    Planning = 1,
    
    /// <summary>
    /// State when order is being delivered to client
    /// </summary>
    Delivering = 2,
    
    /// <summary>
    /// State when order is processed and finished
    /// </summary>
    Finished = 3,

    /// <summary>
    /// Indicates that the order has been canceled, and no further actions will take place with this order.
    /// </summary>
    Cancelled = 4
}