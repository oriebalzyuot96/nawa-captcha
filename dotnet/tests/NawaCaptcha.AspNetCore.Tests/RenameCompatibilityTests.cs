using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace NawaCaptcha.AspNetCore.Tests;

/// <summary>Nawa Guard was renamed to Nawa Captcha: the old header, field, section and entry points keep working.</summary>
public sealed class RenameCompatibilityTests
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

    private static ServiceProvider Services(Action<NawaCaptchaOptions>? extra = null) => new ServiceCollection()
        .AddLogging()
        .AddSingleton<TimeProvider>(new FixedTime { Now = DateTimeOffset.FromUnixTimeMilliseconds(Data.NowUnixMs).AddSeconds(3) })
        .AddNawaCaptcha(o =>
        {
            o.Secret = Data.Secrets["k1"];
            extra?.Invoke(o);
        })
        .BuildServiceProvider();

    private static HttpContext Request(IServiceProvider services, string header, string token)
    {
        var http = new DefaultHttpContext { RequestServices = services };
        http.Connection.RemoteIpAddress = IPAddress.Parse("::ffff:" + Data.Client.Ip);
        http.Request.Headers.UserAgent = Data.Client.UserAgent;
        http.Request.Headers[header] = token;
        return http;
    }

    [Fact]
    public async Task Accepts_the_legacy_header_by_default()
    {
        var services = Services();
        var verifier = services.GetRequiredService<INawaCaptchaVerifier>();
        var result = await verifier.VerifyAsync(Request(services, "X-Nawa-Guard-Token", Data.Tokens["boundLogin"]), "login");
        Assert.True(result.Success, result.Error.ToCode());
    }

    [Fact]
    public async Task Legacy_names_can_be_turned_off()
    {
        var services = Services(o => o.AcceptLegacyNames = false);
        var verifier = services.GetRequiredService<INawaCaptchaVerifier>();
        var result = await verifier.VerifyAsync(Request(services, "X-Nawa-Guard-Token", Data.Tokens["boundLogin"]), "login");
        Assert.Equal(NawaCaptchaError.MissingToken, result.Error);
    }

    [Fact]
    public void Reads_the_NawaCaptcha_section_or_falls_back_to_the_legacy_NawaGuard_section()
    {
        IConfiguration Config(string section) => new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [$"{section}:Secret"] = Data.Secrets["k1"], [$"{section}:MaxAgeSeconds"] = "77" })
            .Build();

        foreach (var section in new[] { "NawaCaptcha", "NawaGuard" })
        {
            var options = new ServiceCollection().AddNawaCaptcha(Config(section)).BuildServiceProvider().GetRequiredService<IOptions<NawaCaptchaOptions>>().Value;
            Assert.Equal(77, options.MaxAgeSeconds);
        }

        var both = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["NawaCaptcha:Secret"] = Data.Secrets["k1"], ["NawaCaptcha:MaxAgeSeconds"] = "11",
                ["NawaGuard:Secret"] = Data.Secrets["k1"], ["NawaGuard:MaxAgeSeconds"] = "22",
            })
            .Build();
        var preferred = new ServiceCollection().AddNawaCaptcha(both).BuildServiceProvider().GetRequiredService<IOptions<NawaCaptchaOptions>>().Value;
        Assert.Equal(11, preferred.MaxAgeSeconds);
    }

#pragma warning disable CS0618 // exercising the deprecated aliases on purpose
    [Fact]
    public async Task Deprecated_entry_points_still_work()
    {
        var services = new ServiceCollection()
            .AddLogging()
            .AddSingleton<TimeProvider>(new FixedTime { Now = DateTimeOffset.FromUnixTimeMilliseconds(Data.NowUnixMs).AddSeconds(3) })
            .AddNawaGuard(o => o.Secret = Data.Secrets["k1"])
            .BuildServiceProvider();
        var legacy = services.GetRequiredService<INawaGuardVerifier>();
        Assert.Same(services.GetRequiredService<INawaCaptchaVerifier>(), legacy);
        var result = await legacy.VerifyAsync(Request(services, "X-Nawa-Captcha-Token", Data.Tokens["boundLogin"]), "login");
        Assert.True(result.Success, result.Error.ToCode());
        Assert.Equal("login", new RequireNawaGuardAttribute("login").Action);
    }
#pragma warning restore CS0618
}
