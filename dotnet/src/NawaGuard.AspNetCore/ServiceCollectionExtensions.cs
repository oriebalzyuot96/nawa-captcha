using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace NawaGuard.AspNetCore;

public static class NawaGuardServiceCollectionExtensions
{
    /// <summary>
    /// Registers <see cref="INawaGuardVerifier"/>. Example:
    /// <code>
    /// builder.Services.AddNawaGuard(o =&gt; o.Secret = builder.Configuration["NawaGuard:Secret"]);
    /// </code>
    /// Uses an in-memory replay store unless an <see cref="INawaGuardReplayStore"/> is registered first.
    /// </summary>
    public static IServiceCollection AddNawaGuard(this IServiceCollection services, Action<NawaGuardOptions> configure)
    {
        services.AddOptions<NawaGuardOptions>()
            .Configure(configure)
            .Validate(o => o.Secrets.Count > 0 && o.Secrets.All(s => s.Secret.Length >= 32), "NawaGuard: at least one secret of 32+ characters is required.")
            .ValidateOnStart();
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<INawaGuardReplayStore>(sp => new InMemoryReplayStore(sp.GetRequiredService<TimeProvider>()));
        services.TryAddSingleton<INawaGuardVerifier, NawaGuardVerifier>();
        return services;
    }

    /// <summary>Binds options from a configuration section, e.g. <c>builder.Configuration.GetSection("NawaGuard")</c>.</summary>
    public static IServiceCollection AddNawaGuard(this IServiceCollection services, IConfiguration section, Action<NawaGuardOptions>? configure = null)
    {
        return services.AddNawaGuard(o =>
        {
            section.Bind(o);
            configure?.Invoke(o);
        });
    }
}
