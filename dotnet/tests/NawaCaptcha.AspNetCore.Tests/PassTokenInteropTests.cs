using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace NawaCaptcha.AspNetCore.Tests;

/// <summary>Verifies tokens produced by the Node implementation (fixtures/pass-tokens.json).</summary>
public sealed class PassTokenInteropTests
{
    private sealed class FixedTime : TimeProvider
    {
        public DateTimeOffset Now { get; set; }

        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed record Fixture(long NowUnixMs, Dictionary<string, string> Secrets, FixtureClient Client, string SiteKey, Dictionary<string, string> Tokens, string[] ChallengeTypes);

    private sealed record FixtureClient(string Ip, string UserAgent);

    private static readonly Fixture Data = JsonSerializer.Deserialize<Fixture>(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", "pass-tokens.json")),
        new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

    private static NawaCaptchaClient Client => new(Data.Client.Ip, Data.Client.UserAgent);

    private static (NawaCaptchaVerifier Verifier, FixedTime Clock) Create(Action<NawaCaptchaOptions>? configure = null, params string[] kids)
    {
        var options = new NawaCaptchaOptions
        {
            Secrets = (kids.Length == 0 ? new[] { "k1" } : kids).Select(k => new NawaCaptchaSecret(k, Data.Secrets[k])).ToList(),
            ExpectedSiteKey = Data.SiteKey,
        };
        configure?.Invoke(options);
        var clock = new FixedTime { Now = DateTimeOffset.FromUnixTimeMilliseconds(Data.NowUnixMs).AddSeconds(3) };
        return (new NawaCaptchaVerifier(Options.Create(options), new InMemoryReplayStore(clock), clock), clock);
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
        Assert.Equal(NawaCaptchaError.Replayed, second.Error);
    }

    [Fact]
    public async Task Normalizes_ipv4_mapped_ipv6_like_node()
    {
        // Node bound the token to "::ffff:203.0.113.7"; .NET sees the IPv4 form.
        var (verifier, _) = Create();
        var result = await verifier.VerifyAsync(Data.Tokens["boundLogin"], "login", new NawaCaptchaClient("::FFFF:" + Data.Client.Ip, Data.Client.UserAgent));
        Assert.True(result.Success, result.Error.ToCode());
    }

    [Fact]
    public async Task Rejects_wrong_action_client_and_tampering()
    {
        var (verifier, _) = Create();
        Assert.Equal(NawaCaptchaError.ActionMismatch, (await verifier.VerifyAsync(Data.Tokens["boundLogin"], "checkout", Client)).Error);
        Assert.Equal(NawaCaptchaError.ClientMismatch, (await verifier.VerifyAsync(Data.Tokens["boundLogin"], "login", Client with { UserAgent = "curl/8.0" })).Error);
        Assert.Equal(NawaCaptchaError.ClientMismatch, (await verifier.VerifyAsync(Data.Tokens["boundLogin"], "login", Client with { Ip = "198.51.100.9" })).Error);
        Assert.Equal(NawaCaptchaError.ClientMismatch, (await verifier.VerifyAsync(Data.Tokens["boundLogin"], "login", null)).Error);

        var parts = Data.Tokens["boundLogin"].Split('.');
        var json = Encoding.UTF8.GetString(Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlDecode(parts[2]));
        parts[2] = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(json.Replace("\"login\"", "\"admin\"")));
        Assert.Equal(NawaCaptchaError.BadSignature, (await verifier.VerifyAsync(string.Join('.', parts), "admin", Client)).Error);

        Assert.Equal(NawaCaptchaError.MissingToken, (await verifier.VerifyAsync(null, "login", Client)).Error);
        Assert.Equal(NawaCaptchaError.Malformed, (await verifier.VerifyAsync("ngp1.k1.abc", "login", Client)).Error);
        Assert.Equal(NawaCaptchaError.Malformed, (await verifier.VerifyAsync("ngp1.k1.a+b.c", "login", Client)).Error);
    }

    [Fact]
    public async Task Enforces_expiry_max_age_site_and_types()
    {
        var (expiredVerifier, clock) = Create();
        clock.Now = clock.Now.AddMinutes(10);
        Assert.Equal(NawaCaptchaError.Expired, (await expiredVerifier.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Error);

        var (aged, agedClock) = Create(o => o.MaxAgeSeconds = 30);
        agedClock.Now = agedClock.Now.AddSeconds(60);
        Assert.Equal(NawaCaptchaError.TooOld, (await aged.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Error);

        var (site, _) = Create(o => o.ExpectedSiteKey = "other-site");
        Assert.Equal(NawaCaptchaError.SiteMismatch, (await site.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Error);

        var (typed, _) = Create(o => o.AllowedTypes = new() { "slider", "icons" });
        Assert.Equal(NawaCaptchaError.TypeNotAllowed, (await typed.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Error);

        var (early, earlyClock) = Create();
        earlyClock.Now = earlyClock.Now.AddMinutes(-5);
        Assert.Equal(NawaCaptchaError.NotYetValid, (await early.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Error);
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
        Assert.Equal(NawaCaptchaError.UnknownKey, (await onlyOld.VerifyAsync(Data.Tokens["rotatedK2"], "login", Client)).Error);

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
            .AddNawaCaptcha(o => o.Secret = Data.Secrets["k1"])
            .BuildServiceProvider();

        HttpContext Request()
        {
            var http = new DefaultHttpContext { RequestServices = services };
            http.Connection.RemoteIpAddress = IPAddress.Parse("::ffff:" + Data.Client.Ip);
            http.Request.Headers.UserAgent = Data.Client.UserAgent;
            http.Request.Headers["X-Nawa-Captcha-Token"] = Data.Tokens["boundLogin"];
            return http;
        }

        var filter = new NawaCaptchaEndpointFilter("login");
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
    public void Knows_every_challenge_type_the_node_server_issues()
    {
        Assert.Equal(Data.ChallengeTypes, NawaCaptchaChallengeTypes.All);
        Assert.Throws<InvalidOperationException>(() => Create(o => o.AllowedTypes = new() { "sliders" }));
        Assert.Throws<InvalidOperationException>(() => Create(o => o.ActionAllowedTypes["login"] = new() { "nope" }));
    }

    [Fact]
    public async Task Reads_multi_step_tokens_and_applies_allowed_types_to_any_solved_step()
    {
        var (verifier, _) = Create();
        var result = await verifier.VerifyAsync(Data.Tokens["multiStepCheckout"], "checkout", null);
        Assert.True(result.Success, result.Error.ToCode());
        Assert.Equal("math", result.Claims!.Type);
        Assert.Equal(new[] { "pow", "math" }, result.Claims.SolvedTypes);

        // "math" was one of the solved steps, so a route that only accepts math passes.
        var (mathOnly, _) = Create(o => o.AllowedTypes = new() { "math" });
        Assert.True((await mathOnly.VerifyAsync(Data.Tokens["multiStepCheckout"], "checkout", null)).Success);

        var (sliderOnly, _) = Create(o => o.AllowedTypes = new() { "slider" });
        Assert.Equal(NawaCaptchaError.TypeNotAllowed, (await sliderOnly.VerifyAsync(Data.Tokens["multiStepCheckout"], "checkout", null)).Error);

        var (threeSteps, _) = Create(o => o.MinSteps = 3);
        Assert.Equal(NawaCaptchaError.TooFewSteps, (await threeSteps.VerifyAsync(Data.Tokens["multiStepCheckout"], "checkout", null)).Error);
    }

    [Fact]
    public async Task Per_action_and_per_route_requirements_override_the_global_list()
    {
        // Global list rejects pow, the checkout action allows it.
        var (perAction, _) = Create(o =>
        {
            o.AllowedTypes = new() { "slider" };
            o.ActionAllowedTypes["contact"] = new() { "pow" };
        });
        Assert.True((await perAction.VerifyAsync(Data.Tokens["unboundContact"], "contact", null)).Success);

        var (route, _) = Create();
        var single = await route.VerifyAsync(Data.Tokens["unboundContact"], "contact", null, new NawaCaptchaRequirements(MinSteps: 2));
        Assert.Equal(NawaCaptchaError.TooFewSteps, single.Error);
        Assert.Equal("too-few-steps", single.Error.ToCode());
        var typed = await route.VerifyAsync(Data.Tokens["unboundContact"], "contact", null, new NawaCaptchaRequirements(AllowedTypes: new[] { "maze" }));
        Assert.Equal(NawaCaptchaError.TypeNotAllowed, typed.Error);
        Assert.True((await route.VerifyAsync(Data.Tokens["multiStepCheckout"], "checkout", null, new NawaCaptchaRequirements(new[] { "pow" }, 2))).Success);
    }

    [Fact]
    public void Single_step_tokens_have_no_steps_claim()
    {
        var payload = Data.Tokens["unboundContact"].Split('.')[2];
        var json = Encoding.UTF8.GetString(Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlDecode(payload));
        Assert.DoesNotContain("stp", json);
    }

    [Fact]
    public void Options_validation_rejects_weak_secrets()
    {
        var services = new ServiceCollection().AddNawaCaptcha(o => o.Secret = "short").BuildServiceProvider();
        Assert.Throws<OptionsValidationException>(() => services.GetRequiredService<IOptions<NawaCaptchaOptions>>().Value);
    }
}
