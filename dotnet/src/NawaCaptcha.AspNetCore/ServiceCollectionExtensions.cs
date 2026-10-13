using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace NawaCaptcha.AspNetCore;

public static class NawaCaptchaServiceCollectionExtensions
{
    /// <summary>
    /// Registers <see cref="INawaCaptchaVerifier"/>. Example:
    /// <code>
    /// builder.Services.AddNawaCaptcha(o =&gt; o.Secret = builder.Configuration["NawaCaptcha:Secret"]);
    /// </code>
    /// Uses an in-memory replay store unless an <see cref="INawaCaptchaReplayStore"/> is registered first.
    /// </summary>
    public static IServiceCollection AddNawaCaptcha(this IServiceCollection services, Action<NawaCaptchaOptions> configure)
    {
        services.AddOptions<NawaCaptchaOptions>()
            .Configure(configure)
            .Validate(o => o.Secrets.Count > 0 && o.Secrets.All(s => s.Secret.Length >= 32), "NawaCaptcha: at least one secret of 32+ characters is required.")
            .ValidateOnStart();
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<INawaCaptchaReplayStore>(sp => new InMemoryReplayStore(sp.GetRequiredService<TimeProvider>()));
        services.TryAddSingleton<INawaCaptchaVerifier, NawaCaptchaVerifier>();
#pragma warning disable CS0618 // deprecated alias kept resolvable for this release
        services.TryAddSingleton<INawaGuardVerifier>(sp => sp.GetRequiredService<INawaCaptchaVerifier>() as INawaGuardVerifier
            ?? throw new InvalidOperationException("NawaCaptcha: the registered INawaCaptchaVerifier does not implement the deprecated INawaGuardVerifier."));
#pragma warning restore CS0618
        return services;
    }

    /// <summary>
    /// Binds options from configuration. Pass a section (<c>builder.Configuration.GetSection("NawaCaptcha")</c>) or the
    /// whole configuration (<c>builder.Configuration</c>): then the "NawaCaptcha" section is used, or the legacy
    /// "NawaGuard" section when only that one exists.
    /// </summary>
    public static IServiceCollection AddNawaCaptcha(this IServiceCollection services, IConfiguration section, Action<NawaCaptchaOptions>? configure = null)
    {
        var effective = section.GetSection(SectionName).Exists() ? section.GetSection(SectionName)
            : section.GetSection(LegacySectionName).Exists() ? section.GetSection(LegacySectionName)
            : section;
        return services.AddNawaCaptcha(o =>
        {
            effective.Bind(o);
            configure?.Invoke(o);
        });
    }

    /// <summary>The configuration section name ("NawaCaptcha").</summary>
    public const string SectionName = "NawaCaptcha";

    /// <summary>The pre-rename section name ("NawaGuard"), read as a fallback.</summary>
    public const string LegacySectionName = "NawaGuard";
}
