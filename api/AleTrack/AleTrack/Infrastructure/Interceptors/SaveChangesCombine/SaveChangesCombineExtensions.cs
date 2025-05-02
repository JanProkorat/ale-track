using Microsoft.EntityFrameworkCore;

namespace AleTrack.Infrastructure.Interceptors.SaveChangesCombine;

/// <summary>
/// Class with methods for registering use of <see cref="SaveChangesCombineInterceptor"/> on <see cref="DbContext"/>
/// </summary>
public static class SaveChangesCombineExtensions
{
    /// <summary>
    /// Register <see cref="SaveChangesCombineInterceptor"/> to <see cref="DbContext"/>
    /// </summary>
    /// <param name="optionsBuilder"><see cref="DbContextOptionsBuilder"/> of <see cref="DbContext"/> which should use <see cref="SaveChangesCombineInterceptor"/></param>
    /// <param name="combinableInterceptors"><see cref="SaveChangesCombinableInterceptor"/> interceptors which should be combined</param>
    /// <returns><see cref="DbContextOptionsBuilder"/> with registered interceptor</returns>
    /// <exception cref="ArgumentNullException"> in case that optionsBuilder parameter is null</exception>
    public static DbContextOptionsBuilder UseCombineOf(this DbContextOptionsBuilder optionsBuilder, params SaveChangesCombinableInterceptor[] combinableInterceptors)
    {
        optionsBuilder.AddInterceptors(new SaveChangesCombineInterceptor(combinableInterceptors));
        return optionsBuilder;
    }

    /// <summary>
    /// Register <see cref="SaveChangesCombineInterceptor"/> to <see cref="DbContext"/>
    /// </summary>
    /// <param name="optionsBuilder"><see cref="DbContextOptionsBuilder"/> of <see cref="DbContext"/> which should use <see cref="SaveChangesCombineInterceptor"/></param>
    /// <param name="combinableInterceptors"><see cref="SaveChangesCombinableInterceptor"/> interceptors which should be combined</param>
    /// <typeparam name="TContext"> type of <see cref="DbContext"/> for interceptor registering</typeparam>
    /// <returns><see cref="DbContextOptionsBuilder"/> with registered interceptor</returns>
    /// <exception cref="ArgumentNullException"> in case that optionsBuilder parameter is null</exception>
    public static DbContextOptionsBuilder<TContext> UseCombineOf<TContext>(this DbContextOptionsBuilder<TContext> optionsBuilder, params SaveChangesCombinableInterceptor[] combinableInterceptors)
        where TContext : DbContext
    {
        optionsBuilder.AddInterceptors(new SaveChangesCombineInterceptor(combinableInterceptors));
        return optionsBuilder;
    }
}
