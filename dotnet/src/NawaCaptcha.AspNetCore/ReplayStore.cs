using System.Collections.Concurrent;

namespace NawaCaptcha.AspNetCore;

/// <summary>
/// One-time redemption of pass-token ids. Must be atomic across every instance that verifies tokens:
/// use the in-memory store only for a single instance, and a shared store (e.g. Redis
/// <c>SET key 1 PX ttl NX</c>) behind a load balancer.
/// </summary>
public interface INawaCaptchaReplayStore
{
    /// <summary>Returns true the first time <paramref name="jti"/> is redeemed, false on every later call.</summary>
    Task<bool> TryRedeemAsync(string jti, TimeSpan ttl, CancellationToken cancellationToken = default);
}

/// <summary>Process-local store with expiry. Safe for one instance only.</summary>
public sealed class InMemoryReplayStore : INawaCaptchaReplayStore
{
    private readonly ConcurrentDictionary<string, DateTimeOffset> _used = new(StringComparer.Ordinal);
    private readonly TimeProvider _time;
    private long _calls;

    public InMemoryReplayStore(TimeProvider time) => _time = time;

    public Task<bool> TryRedeemAsync(string jti, TimeSpan ttl, CancellationToken cancellationToken = default)
    {
        var now = _time.GetUtcNow();
        if (Interlocked.Increment(ref _calls) % 1024 == 0)
        {
            foreach (var (key, expiry) in _used)
            {
                if (expiry <= now)
                {
                    _used.TryRemove(key, out _);
                }
            }
        }

        // TryAdd is atomic: of two concurrent redemptions exactly one succeeds.
        if (_used.TryAdd(jti, now + ttl))
        {
            return Task.FromResult(true);
        }

        // An expired leftover may be replaced (the token itself is expired by then anyway).
        if (_used.TryGetValue(jti, out var existing) && existing <= now && _used.TryUpdate(jti, now + ttl, existing))
        {
            return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }
}

/// <summary>Adapter for any atomic "set if absent" primitive, e.g. StackExchange.Redis <c>StringSetAsync(key, "1", ttl, When.NotExists)</c>.</summary>
public sealed class DelegateReplayStore : INawaCaptchaReplayStore
{
    private readonly Func<string, TimeSpan, CancellationToken, Task<bool>> _setIfAbsent;

    public DelegateReplayStore(Func<string, TimeSpan, CancellationToken, Task<bool>> setIfAbsent) => _setIfAbsent = setIfAbsent;

    public Task<bool> TryRedeemAsync(string jti, TimeSpan ttl, CancellationToken cancellationToken = default) =>
        _setIfAbsent("nawa-guard:pass:" + jti, ttl, cancellationToken);
}
