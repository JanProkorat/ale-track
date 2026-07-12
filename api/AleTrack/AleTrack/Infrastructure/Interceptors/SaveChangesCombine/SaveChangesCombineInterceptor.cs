using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace AleTrack.Infrastructure.Interceptors.SaveChangesCombine;

/// <summary>
/// Interceptor for handling combined automations of multiple interceptors implementing <see cref="SaveChangesCombinableInterceptor"/> interface
/// </summary>
public sealed class SaveChangesCombineInterceptor : SaveChangesInterceptor
{
    /// <summary>
    /// Dictionary for holding all combined interceptors saving changes actions
    /// </summary>
    private readonly Dictionary<EntityState, ICollection<Action<EntityEntry>>> _savingChangesActions = new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors saving changes async functions
    /// </summary>
    private readonly Dictionary<EntityState, ICollection<Func<EntityEntry, CancellationToken, Task>>> _savingChangesAsyncFunctions = new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors saved changes actions
    /// </summary>
    private readonly Dictionary<EntityState, ICollection<Action<EntityEntry>>> _savedChangesActions = new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors saved changes async functions
    /// </summary>
    private readonly Dictionary<EntityState, ICollection<Func<EntityEntry, CancellationToken, Task>>> _savedChangesAsyncFunctions = new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors save changes canceled actions
    /// </summary>
    private readonly Dictionary<EntityState, ICollection<Action<EntityEntry>>> _saveChangesCanceledActions = new();
    /// <summary>
    /// Dictionary for holding all combined interceptors save changes canceled async functions
    /// </summary>
    private readonly Dictionary<EntityState, ICollection<Func<EntityEntry, CancellationToken, Task>>> _saveChangesCanceledAsyncFunctions = new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors save changes failed actions
    /// </summary>
    private readonly Dictionary<EntityState, ICollection<Action<EntityEntry>>> _saveChangesFailedActions = new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors save changes failed async functions
    /// </summary>
    private readonly Dictionary<EntityState, ICollection<Func<EntityEntry, CancellationToken, Task>>> _saveChangesFailedAsyncFunctions = new ();
    
    /// <summary>
    /// Dictionary for holding all combined interceptors throwing concurrency exception actions
    /// </summary>
    private readonly Dictionary<EntityState, ICollection<Action<EntityEntry>>> _throwingConcurrencyExceptionActions = new ();
    /// <summary>
    /// Dictionary for holding all combined interceptors throwing concurrency exception async functions
    /// </summary>
    private readonly Dictionary<EntityState, ICollection<Func<EntityEntry, CancellationToken, Task>>> _throwingConcurrencyExceptionAsyncFunctions = new ();

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="combinables"><see cref="IEnumerable{T}"/> of <see cref="SaveChangesCombinableInterceptor"/> holding all interceptors to combine</param>
    // ReSharper disable once IdentifierTypo
    public SaveChangesCombineInterceptor(IEnumerable<SaveChangesCombinableInterceptor> combinables)
    {
        foreach (var combinable in combinables)
        {
            MergeCombinables(_savingChangesActions, combinable.OnSavingChanges);
            MergeCombinables(_savingChangesAsyncFunctions, combinable.OnSavingChangesAsync);
            MergeCombinables(_savedChangesActions, combinable.OnSavedChanges);
            MergeCombinables(_savedChangesAsyncFunctions, combinable.OnSavedChangesAsync);
            MergeCombinables(_saveChangesCanceledActions, combinable.OnSaveChangesCanceled);
            MergeCombinables(_saveChangesCanceledAsyncFunctions, combinable.OnSaveChangesCanceledAsync);
            MergeCombinables(_saveChangesFailedActions, combinable.OnSaveChangesFailed);
            MergeCombinables(_saveChangesFailedAsyncFunctions, combinable.OnSaveChangesFailedAsync);
            MergeCombinables(_throwingConcurrencyExceptionActions, combinable.OnThrowingConcurrencyException);
            MergeCombinables(_throwingConcurrencyExceptionAsyncFunctions, combinable.OnThrowingConcurrencyExceptionAsync);
        }
    }
    
    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will run all registered combined interceptors
    /// </remarks>
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        RunCombinedInterceptors(eventData, _savingChangesActions);
        return base.SavingChanges(eventData, result);
    }

    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will run all registered combined interceptors
    /// </remarks>
    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        await RunCombinedInterceptorsAsync(eventData, _savingChangesAsyncFunctions, cancellationToken)
            .ConfigureAwait(false);
        
        return await base.SavingChangesAsync(eventData, result, cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will run all registered combined interceptors
    /// </remarks>
    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        RunCombinedInterceptors(eventData, _savedChangesActions);
        return base.SavedChanges(eventData, result);
    }

    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will run all registered combined interceptors
    /// </remarks>
    public override async ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result,
        CancellationToken cancellationToken = default)
    {
        await RunCombinedInterceptorsAsync(eventData, _savedChangesAsyncFunctions, cancellationToken)
            .ConfigureAwait(false);
        
        return await base.SavedChangesAsync(eventData, result, cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will run all registered combined interceptors
    /// </remarks>
    public override void SaveChangesCanceled(DbContextEventData eventData)
    {
        RunCombinedInterceptors(eventData, _saveChangesCanceledActions);
        base.SaveChangesCanceled(eventData);
    }

    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will run all registered combined interceptors
    /// </remarks>
    public override async Task SaveChangesCanceledAsync(DbContextEventData eventData,
        CancellationToken cancellationToken = default)
    {
        await RunCombinedInterceptorsAsync(eventData, _saveChangesCanceledAsyncFunctions, cancellationToken)
            .ConfigureAwait(false);
        await base.SaveChangesCanceledAsync(eventData, cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will run all registered combined interceptors
    /// </remarks>
    public override void SaveChangesFailed(DbContextErrorEventData eventData)
    {
        RunCombinedInterceptors(eventData, _saveChangesFailedActions);
        base.SaveChangesFailed(eventData);
    }

    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will run all registered combined interceptors
    /// </remarks>
    public override async Task SaveChangesFailedAsync(DbContextErrorEventData eventData,
        CancellationToken cancellationToken = default)
    {
        await RunCombinedInterceptorsAsync(eventData, _saveChangesFailedAsyncFunctions, cancellationToken)
            .ConfigureAwait(false);
        
        await base.SaveChangesFailedAsync(eventData, cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will run all registered combined interceptors
    /// </remarks>
    public override InterceptionResult ThrowingConcurrencyException(ConcurrencyExceptionEventData eventData, InterceptionResult result)
    {
        RunCombinedInterceptors(eventData, _throwingConcurrencyExceptionActions);
        return base.ThrowingConcurrencyException(eventData, result);
    }

    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will run all registered combined interceptors
    /// </remarks>
    public override async ValueTask<InterceptionResult> ThrowingConcurrencyExceptionAsync(ConcurrencyExceptionEventData eventData, InterceptionResult result,
        CancellationToken cancellationToken = default)
    {
        await RunCombinedInterceptorsAsync(eventData, _throwingConcurrencyExceptionAsyncFunctions, cancellationToken);
        return await base.ThrowingConcurrencyExceptionAsync(eventData, result, cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>
    /// Run all async functions from combined interceptors
    /// </summary>
    /// <param name="eventData"><see cref="DbContextEventData"/> with all necessary data</param>
    /// <param name="combinedActions"><see cref="IReadOnlyDictionary{TKey,TValue}"/> with <see cref="EntityState"/> keys and and actions for run on saving entities</param>
    private static void RunCombinedInterceptors(DbContextEventData? eventData, IReadOnlyDictionary<EntityState,ICollection<Action<EntityEntry>>> combinedActions)
    {
        var changeTracker = eventData?.Context?.ChangeTracker;
        
        if (changeTracker is null || !changeTracker.HasChanges())
            return;
        
        foreach (var entityEntry in changeTracker.Entries())
        {
            if (!combinedActions.TryGetValue(entityEntry.State, out var stateCombinedActions))
                continue;
            
            foreach (var stateAction in stateCombinedActions)
            {
                stateAction(entityEntry);
            }
        }
    }

    /// <summary>
    /// Run all async functions from combined interceptors
    /// </summary>
    /// <param name="eventData"><see cref="DbContextEventData"/> with all necessary data</param>
    /// <param name="combinedAsyncFunctions"><see cref="IReadOnlyDictionary{TKey,TValue}"/> with <see cref="EntityState"/> keys and and functions for run on saving entities</param>
    /// <param name="cancellationToken"><see cref="CancellationToken"/> form cancelling combined async functions</param>
    private static async Task RunCombinedInterceptorsAsync(
        DbContextEventData? eventData,
        IReadOnlyDictionary<EntityState, ICollection<Func<EntityEntry, CancellationToken, Task>>> combinedAsyncFunctions,
        CancellationToken cancellationToken = default)
    {
        var changeTracker = eventData?.Context?.ChangeTracker;
        
        if (changeTracker is null || !changeTracker.HasChanges())
            return;
        
        foreach (var entityEntry in changeTracker.Entries())
        {
            if (!combinedAsyncFunctions.TryGetValue(entityEntry.State, out var stateCombinedAsyncFunctions))
                continue;
            
            foreach (var stateAsyncFunction in stateCombinedAsyncFunctions)
            {
                await stateAsyncFunction(entityEntry, cancellationToken).ConfigureAwait(false);
            }
        }
    }
    
    /// <summary>
    /// Merge source <see cref="SaveChangesCombineInterceptor"/> dictionary to <see cref="SaveChangesCombinableInterceptor"/> one
    /// </summary>
    /// <param name="destination"><see cref="Dictionary{TKey,TValue}"/> where should be merged source one</param>
    /// <param name="source"><see cref="Dictionary{TKey,TValue}"/> which should be merged to destination one</param>
    /// <typeparam name="TValue">type of merged dictionaries value</typeparam>
    // ReSharper disable once IdentifierTypo
    private static void MergeCombinables<TValue>(
        Dictionary<EntityState, ICollection<TValue>>? destination,
        Dictionary<EntityState, TValue>? source)
    {
        if (source is null || source.Count == 0)
            return;

        destination ??= new Dictionary<EntityState, ICollection<TValue>>();

        foreach (var pairFromSource in source.Where(pair => !destination.TryAdd(pair.Key, new List<TValue>{ pair.Value })))
        {
            destination[pairFromSource.Key].Add(pairFromSource.Value);
        }
    }
}
