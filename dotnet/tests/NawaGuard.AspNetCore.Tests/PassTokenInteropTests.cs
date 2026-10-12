using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace NawaGuard.AspNetCore.Tests;

/// <summary>Verifies tokens produced by the Node implementation (fixtures/pass-tokens.json).</summary>
public sealed class PassTokenInteropTests
{
    private sealed class FixedTime : TimeProvider
    {
        public DateTimeOffset Now { get; set; }

        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed record Fixture(long NowUnixMs, Dictionary<string, string> Secrets, FixtureClient Client, string SiteKey, Dictionary<string, string> Tokens);

    private sealed record FixtureClient(string Ip, string UserAgent);

    private static readonly Fixture Data = JsonSerializer.Deserialize<Fixture>(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", "pass-tokens.json")),
        new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

    private static NawaGuardClient Client => new(Data.Client.Ip, Data.Client.UserAgent);

    private static (NawaGuardVerifier Verifier, FixedTime Clock) Create(Action<NawaGuardOptions>? configure = null, params string[] kids)
    {
        var options = new NawaGuardOptions
        {
            Secrets = (kids.Length == 0 ? new[] { "k1" } : kids).Select(k => new NawaGuardSecret(k, Data.Secrets[k])).ToList(),
            ExpectedSiteKey = Data.SiteKey,
        };
        configure?.Invoke(options);
        var clock = new FixedTime { Now = DateTimeOffset.FromUnixTimeMilliseconds(Data.NowUnixMs).AddSeconds(3) };
        return (new NawaGuardVerifier(Options.Create(options), new InMemoryReplayStore(clock), clock), clock);
    }

    [Fact]
    public async Task Verifies_a_bound_token_from_node_exactly_once()
    {
        var (verifier, _) = Create();
        var first = await verifier.VerifyAsync(Data.Tokens["boundLogin"], "login", Client);
        Assert.True(first.Success, first.Error.ToCode());
        Assert.Equal("login", first.Claims!.Action);
        Assert.Equal("pow", first.Claims.Type);
        Assert.Equal("ip+ua", first.Claims.BindMode);

        var second = await verifier.VerifyAsync(Data.Tokens["boundLogin"], "login", Client);
        Assert.Equal(NawaGuardError.Replayed, second.Error);
    }

    [Fact]
    public async Task Normalizes_ipv4_mapped_ipv6_like_node()
    {
        // Node bound the token to "::ffff:203.0.113.7"; .NET sees the IPv4 form.
        var (verifier, _) = Create();
        var result = await verifier.VerifyAsync(Data.Tokens["boundLogin"], "login", new NawaGuardClient("::FFFF:" + Data.Client.Ip, Data.Client.UserAgent));
        Assert.True(result.Success, result.Error.ToCode());
    }

    [Fact]
    public async Task Rejects_wrong_action_client_and_tampering()
    {
        var (verifier, _) = Create();
        Assert.Equal(NawaGuardError.ActionMismatch, (await verifier.VerifyAsync(Data.Tokens["boundLogin"], "checkout", Client)).Error);
        Assert.Equal(NawaGuardError.ClientMismatch, (await verifier.VerifyAsync(Data.Tokens["boundLogin"], "login", Client with { UserAgent = "curl/8.0" })).Error);
        Assert.Equal(NawaGuardError.ClientMismatch, (await verifier.VerifyAsync(Data.Tokens["boundLogin"], "login", Client with { Ip = "198.51.100.9" })).Error);
        Assert.Equal(NawaGuardError.ClientMismatch, (await verifier.VerifyAsync(Data.Tokens["boundLogin"], "login", null)).Error);

        var parts = Data.Tokens["boundLogin"].Split('.');
        var json = Encoding.UTF8.GetString(Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlDecode(parts[2]));
        parts[2] = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(json.Replace("\"login\"", "\"admin\"")));
        Assert.Equal(NawaGuardError.BadSignature, (await verifier.VerifyAsync(string.Join('.', parts), "admin", Client)).Error);

        Assert.Equal(NawaGuardError.MissingToken, (await verifier.VerifyAsync(null, "login", Client)).Error);
        Assert.Equal(NawaGuardError.Malformed, (await verifier.VerifyAsync("ngp1.k1.abc", "login", Client)).Error);
        Assert.Equal(NawaGuardError.Malformed, (await verifier.VerifyAsync("ngp1.k1.a+b.c", "login", Client)).Error);
    }

    [Fact]
    public async Task Enforces_expiry_max_age_site_and_types()
    {
        var (expiredVerifier, clock) = Create();
        clock.Now = clock.Now.AddMinutes(10);
        Assert.Equal(NawaGuardError.Expired, (await expiredVerifier.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Error);

        var (aged, agedClock) = Create(o => o.MaxAgeSeconds = 30);
        agedClock.Now = agedClock.Now.AddSeconds(60);
        Assert.Equal(NawaGuardError.TooOld, (await aged.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Error);

        var (site, _) = Create(o => o.ExpectedSiteKey = "other-site");
        Assert.Equal(NawaGuardError.SiteMismatch, (await site.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Error);

        var (typed, _) = Create(o => o.AllowedTypes = new() { "slider", "icons" });
        Assert.Equal(NawaGuardError.TypeNotAllowed, (await typed.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Error);

        var (early, earlyClock) = Create();
        earlyClock.Now = earlyClock.Now.AddMinutes(-5);
        Assert.Equal(NawaGuardError.NotYetValid, (await early.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Error);
    }

    [Fact]
    public async Task Unbound_tokens_need_no_client()
    {
        var (verifier, _) = Create();
        var result = await verifier.VerifyAsync(Data.Tokens["unboundContact"], "contact", null);
        Assert.True(result.Success, result.Error.ToCode());
    }

    [Fact]
    public async Task Supports_key_rotation_by_kid()
    {
        var (onlyOld, _) = Create(null, "k1");
        Assert.Equal(NawaGuardError.UnknownKey, (await onlyOld.VerifyAsync(Data.Tokens["rotatedK2"], "login", Client)).Error);

        var (rotated, _) = Create(null, "k2", "k1");
        var result = await rotated.VerifyAsync(Data.Tokens["rotatedK2"], "login", Client);
        Assert.True(result.Success, result.Error.ToCode());
        Assert.True((await rotated.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Success);
    }

    [Fact]
    public async Task Endpoint_filter_reads_header_and_rejects_replay()
    {
        var clock = new FixedTime { Now = DateTimeOffset.FromUnixTimeMilliseconds(Data.NowUnixMs).AddSeconds(3) };
        var services = new ServiceCollection()
            .AddLogging()
            .AddSingleton<TimeProvider>(clock)
            .AddNawaGuard(o => o.Secret = Data.Secrets["k1"])
            .BuildServiceProvider();

        HttpContext Request()
        {
            var http = new DefaultHttpContext { RequestServices = services };
            http.Connection.RemoteIpAddress = IPAddress.Parse("::ffff:" + Data.Client.Ip);
            http.Request.Headers.UserAgent = Data.Client.UserAgent;
            http.Request.Headers["X-Nawa-Guard-Token"] = Data.Tokens["boundLogin"];
            return http;
        }

        var filter = new NawaGuardEndpointFilter("login");
        var reached = false;
        EndpointFilterDelegate next = _ =>
        {
            reached = true;
            return ValueTask.FromResult<object?>("ok");
        };

        var ok = await filter.InvokeAsync(new DefaultEndpointFilterInvocationContext(Request()), next);
        Assert.True(reached);
        Assert.Equal("ok", ok);

        reached = false;
        var replay = await filter.InvokeAsync(new DefaultEndpointFilterInvocationContext(Request()), next);
        Assert.False(reached);
        var rejected = Assert.IsType<ObjectResult>(replay);
        Assert.Equal(403, rejected.StatusCode);
        Assert.Equal("replayed", Assert.IsType<ProblemDetails>(rejected.Value).Extensions["code"]);
    }

    [Fact]
    public void Options_validation_rejects_weak_secrets()
    {
        var services = new ServiceCollection().AddNawaGuard(o => o.Secret = "short").BuildServiceProvider();
        Assert.Throws<OptionsValidationException>(() => services.GetRequiredService<IOptions<NawaGuardOptions>>().Value);
    }
}
