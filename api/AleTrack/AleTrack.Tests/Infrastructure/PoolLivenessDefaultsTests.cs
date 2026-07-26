using System.Net.Sockets;
using AleTrack.Infrastructure.Persistence;
using FluentAssertions;
using Npgsql;

namespace AleTrack.Tests.Infrastructure;

/// <summary>
/// What counts as "the transport gave out" and is therefore worth retrying on a fresh
/// connection, as opposed to the database rejecting the work.
/// </summary>
public sealed class BrokenConnectionRetryStrategyTests
{
    [Fact]
    public void RecognisesTheMacOsDeadSocketError()
    {
        // The exact shape reported: setting a receive timeout on a socket the pooler already
        // closed returns EINVAL, and the raw SocketException escapes unwrapped.
        var exception = new SocketException((int)SocketError.InvalidArgument);

        BrokenConnectionRetryStrategy.IsBrokenConnection(exception).Should().BeTrue();
    }

    [Fact]
    public void RecognisesAConnectionResetAndABrokenStream()
    {
        BrokenConnectionRetryStrategy.IsBrokenConnection(new SocketException((int)SocketError.ConnectionReset))
            .Should().BeTrue();
        BrokenConnectionRetryStrategy.IsBrokenConnection(new IOException("Exception while reading from stream"))
            .Should().BeTrue();
    }

    [Fact]
    public void LooksThroughWrapperExceptions()
    {
        var wrapped = new InvalidOperationException("outer", new NpgsqlException("inner",
            new SocketException((int)SocketError.InvalidArgument)));

        BrokenConnectionRetryStrategy.IsBrokenConnection(wrapped).Should().BeTrue();
    }

    [Fact]
    public void LeavesRealDatabaseErrorsAlone()
    {
        // Retrying a rejected statement just fails again, slower.
        BrokenConnectionRetryStrategy.IsBrokenConnection(new PostgresException("relation does not exist", "ERROR", "ERROR", "42P01"))
            .Should().BeFalse();
        BrokenConnectionRetryStrategy.IsBrokenConnection(new InvalidOperationException("nothing to do with sockets"))
            .Should().BeFalse();
        BrokenConnectionRetryStrategy.IsBrokenConnection(null).Should().BeFalse();
    }
}

/// <summary>
/// The pool-liveness defaults exist because Npgsql's own defaults let the pool hand out a
/// connection the server already closed — which surfaced as
/// <c>SocketException (22): Invalid argument</c> on the first read of the next command.
/// </summary>
public sealed class PoolLivenessDefaultsTests
{
    private const string Base = "Host=db.example.com;Port=5432;Database=postgres;Username=u;Password=p";

    [Fact]
    public void FillsInKeepaliveAndIdleLifetime()
    {
        var result = new NpgsqlConnectionStringBuilder(Base.WithPoolLivenessDefaults());

        result.KeepAlive.Should().Be(30, "the pooler drops connections that go quiet");
        result.ConnectionIdleLifetime.Should().Be(60, "Npgsql's 300s default outlives the pooler's idle window");
        result.TcpKeepAlive.Should().BeTrue();
    }

    [Fact]
    public void KeepsTheRestOfTheConnectionStringIntact()
    {
        var result = new NpgsqlConnectionStringBuilder(Base.WithPoolLivenessDefaults());

        result.Host.Should().Be("db.example.com");
        result.Database.Should().Be("postgres");
        result.Username.Should().Be("u");
        result.Password.Should().Be("p");
    }

    [Fact]
    public void DoesNotOverrideWhatTheConnectionStringAlreadySays()
    {
        // Whoever wrote the connection string knows their server better than this default does.
        var configured = $"{Base};Keepalive=5;Connection Idle Lifetime=10;Tcp Keepalive=false";

        var result = new NpgsqlConnectionStringBuilder(configured.WithPoolLivenessDefaults());

        result.KeepAlive.Should().Be(5);
        result.ConnectionIdleLifetime.Should().Be(10);
        result.TcpKeepAlive.Should().BeFalse();
    }

    [Fact]
    public void LeavesTheDefaultsOffWhenNpgsqlWouldOtherwiseBeSafe()
    {
        // Sanity check on the premise: without this helper Npgsql really does default to no
        // keepalive and a five-minute idle lifetime.
        var untouched = new NpgsqlConnectionStringBuilder(Base);

        untouched.KeepAlive.Should().Be(0);
        untouched.ConnectionIdleLifetime.Should().Be(300);
    }
}
