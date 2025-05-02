using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

// ReSharper disable VirtualMemberNeverOverridden.Global

namespace AleTrack.Infrastructure.Interceptors.SaveChangesCombine;

/// <summary>
/// Abstract for all save changes interceptors which should be combined via <see cref="SaveChangesCombineInterceptor"/>
/// </summary>
public class SaveChangesCombinableInterceptor : SaveChangesInterceptor
{
    /// <summary>
    /// Dictionary for holding all combined interceptors saving changes actions
    /// </summary>
    public virtual Dictionary<EntityState, Action<EntityEntry>> OnSavingChanges => new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors saving changes async functions
    /// </summary>
    public virtual Dictionary<EntityState, Func<EntityEntry, CancellationToken, Task>> OnSavingChangesAsync => new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors saved changes actions
    /// </summary>
    public virtual Dictionary<EntityState, Action<EntityEntry>> OnSavedChanges => new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors saved changes async functions
    /// </summary>
    public virtual Dictionary<EntityState, Func<EntityEntry, CancellationToken, Task>> OnSavedChangesAsync => new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors save changes canceled actions
    /// </summary>
    public virtual Dictionary<EntityState, Action<EntityEntry>> OnSaveChangesCanceled => new ();
    /// <summary>
    /// Dictionary for holding all combined interceptors save changes canceled async functions
    /// </summary>
    public virtual Dictionary<EntityState, Func<EntityEntry, CancellationToken, Task>> OnSaveChangesCanceledAsync => new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors save changes failed actions
    /// </summary>
    public virtual Dictionary<EntityState, Action<EntityEntry>> OnSaveChangesFailed => new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors save changes failed async functions
    /// </summary>
    public virtual Dictionary<EntityState, Func<EntityEntry, CancellationToken, Task>> OnSaveChangesFailedAsync => new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors throwing concurrency exception actions
    /// </summary>
    public virtual Dictionary<EntityState, Action<EntityEntry>> OnThrowingConcurrencyException => new ();
    /// <summary>
    /// Dictionary for holding all combined interceptors throwing concurrency exception async functions
    /// </summary>
    public virtual Dictionary<EntityState, Func<EntityEntry, CancellationToken, Task>> OnThrowingConcurrencyExceptionAsync => new ();
    
    protected SaveChangesCombinableInterceptor()
    {}
}
