using System.Net.Sockets;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql.EntityFrameworkCore.PostgreSQL;

namespace AleTrack.Infrastructure.Persistence;

/// <summary>
/// The stock Npgsql retry strategy, plus the case where the pool hands out a connection the
/// server has already closed.
/// </summary>
/// <remarks>
/// <see cref="WithPoolLivenessDefaults"/> makes that rare; this makes it survivable. The raw
/// <see cref="SocketException"/> is thrown while setting a timeout on the dead socket, before
/// Npgsql can wrap it as a transient <c>NpgsqlException</c>, so the stock strategy does not
/// recognise it and the request 500s. Retrying re-runs the operation on a fresh connection.
///
/// On macOS the error arrives as <c>SocketException (22): Invalid argument</c>, because setting
/// a receive timeout on a closed socket returns EINVAL rather than the ECONNRESET seen elsewhere
/// — hence matching on the exception type rather than on a specific code.
/// </remarks>
public sealed class BrokenConnectionRetryStrategy(ExecutionStrategyDependencies dependencies)
    : NpgsqlRetryingExecutionStrategy(dependencies, MaxRetries, MaxDelay, errorCodesToAdd: null)
{
    private const int MaxRetries = 3;
    private static readonly TimeSpan MaxDelay = TimeSpan.FromSeconds(5);

    /// <inheritdoc />
    protected override bool ShouldRetryOn(Exception exception) =>
        base.ShouldRetryOn(exception) || IsBrokenConnection(exception);

    /// <summary>
    /// Whether the failure is the transport giving out rather than the database refusing.
    /// </summary>
    public static bool IsBrokenConnection(Exception? exception) => exception switch
    {
        null => false,
        SocketException or IOException => true,
        _ => IsBrokenConnection(exception.InnerException)
    };
}
