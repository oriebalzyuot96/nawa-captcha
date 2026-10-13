using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace NawaCaptcha.AspNetCore;

// Nawa Guard was renamed to Nawa Captcha. These aliases keep existing call sites compiling for this
// release (after changing the using to NawaCaptcha.AspNetCore); they will be removed in a later one.

/// <summary>Deprecated: use <see cref="INawaCaptchaVerifier"/>.</summary>
[Obsolete("Nawa Guard is now Nawa Captcha: use INawaCaptchaVerifier.")]
public interface INawaGuardVerifier : INawaCaptchaVerifier
{
}

/// <summary>Deprecated: use <see cref="RequireNawaCaptchaAttribute"/>.</summary>
[Obsolete("Nawa Guard is now Nawa Captcha: use [RequireNawaCaptcha].")]
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequireNawaGuardAttribute : RequireNawaCaptchaAttribute
{
    public RequireNawaGuardAttribute(string action)
        : base(action)
    {
    }
}

/// <summary>Deprecated registration and endpoint helpers.</summary>
public static class NawaGuardCompatibilityExtensions
{
    /// <summary>Deprecated: use <c>AddNawaCaptcha</c>.</summary>
    [Obsolete("Nawa Guard is now Nawa Captcha: use AddNawaCaptcha.")]
    public static IServiceCollection AddNawaGuard(this IServiceCollection services, Action<NawaCaptchaOptions> configure) =>
        services.AddNawaCaptcha(configure);

    /// <summary>Deprecated: use <c>AddNawaCaptcha</c> (it also reads a legacy "NawaGuard" section).</summary>
    [Obsolete("Nawa Guard is now Nawa Captcha: use AddNawaCaptcha.")]
    public static IServiceCollection AddNawaGuard(this IServiceCollection services, IConfiguration section, Action<NawaCaptchaOptions>? configure = null) =>
        services.AddNawaCaptcha(section, configure);

    /// <summary>Deprecated: use <c>RequireNawaCaptcha</c>.</summary>
    [Obsolete("Nawa Guard is now Nawa Captcha: use RequireNawaCaptcha.")]
    public static TBuilder RequireNawaGuard<TBuilder>(this TBuilder builder, string action)
        where TBuilder : IEndpointConventionBuilder =>
        builder.RequireNawaCaptcha(action);

    /// <summary>Deprecated: use <c>RequireNawaCaptcha</c>.</summary>
    [Obsolete("Nawa Guard is now Nawa Captcha: use RequireNawaCaptcha.")]
    public static TBuilder RequireNawaGuard<TBuilder>(this TBuilder builder, string action, NawaCaptchaRequirements requirements)
        where TBuilder : IEndpointConventionBuilder =>
        builder.RequireNawaCaptcha(action, requirements);
}
