using AleTrack.Entities.BaseEntities;
using AleTrack.Infrastructure.Interceptors.SaveChangesCombine;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace AleTrack.Infrastructure.Interceptors.PublicEntity;

/// <summary>
/// Interceptor for handling automations of insert operations on <see cref="IPublicEntity"/> entities
/// </summary>
public sealed class PublicEntityInterceptor : SaveChangesCombinableInterceptor
{
    /// <inheritdoc />
    public override Dictionary<EntityState, Action<EntityEntry>> OnSavingChanges => new()
    {
        { EntityState.Added, SetPublicId }
    };
    
    /// <inheritdoc />
    public override Dictionary<EntityState, Func<EntityEntry, CancellationToken, Task>> OnSavingChangesAsync => new()
    {
        { EntityState.Added, SetPublicIdAsync }
    };

    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will set public ID property to entries which implements <see cref="IPublicEntity"/>
    /// </remarks>
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        var changeTracker = eventData.Context?.ChangeTracker;

        if (changeTracker is null|| !changeTracker.HasChanges())
        {
            return base.SavingChanges(eventData, result);
        }

        SetPublicIdToAddedEntities(changeTracker);
        
        return base.SavingChanges(eventData, result);
    }

    /// <inheritdoc />
    /// <remarks>
    /// As an addition, it will set public ID property to entries which implements <see cref="IPublicEntity"/>
    /// </remarks>
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        var changeTracker = eventData.Context?.ChangeTracker;

        if (changeTracker is null || !changeTracker.HasChanges())
        {
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }
        
        SetPublicIdToAddedEntities(changeTracker);
       
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    /// <summary>
    /// Sets newly generated <see cref="Guid"/> to <see cref="IPublicEntity.PublicId"/> property for each added entity
    /// in the <see cref="ChangeTracker"/>.
    /// </summary>
    /// <param name="changeTracker"><see cref="ChangeTracker"/> with entities where unique key should be set</param>
    private static void SetPublicIdToAddedEntities(ChangeTracker changeTracker)
    {
        foreach (var entityEntry in changeTracker.Entries()
                     .Where(e => e.State == EntityState.Added))
        {
            SetPublicId(entityEntry);
        }
    }
    
    /// <summary>
    /// Sets newly generated <see cref="Guid"/> to <see cref="IPublicEntity.PublicId"/> property for entity entry
    /// </summary>
    /// <param name="entityEntry"><see cref="EntityEntry"/> where unique key should be set</param>
    // ReSharper disable once IdentifierTypo
    private static void SetPublicId(EntityEntry entityEntry)
    {
        if (entityEntry.Entity is IPublicEntity addedEntity && addedEntity.PublicId == Guid.Empty)
        {
            addedEntity.PublicId = Guid.NewGuid();
        }
    }

    /// <summary>
    /// Sets newly generated <see cref="Guid"/> to <see cref="IPublicEntity.PublicId"/> property for entity entry
    /// </summary>
    /// <param name="entityEntry"><see cref="EntityEntry"/> where unique key should be set</param>
    /// <param name="cancellationToken"><see cref="CancellationToken"/> for canceling setting action</param>
    // ReSharper disable once IdentifierTypo
    private static Task SetPublicIdAsync(EntityEntry entityEntry, CancellationToken cancellationToken = default)
    {
        SetPublicId(entityEntry);
        return Task.CompletedTask;
    }
}
