using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace NawaCaptcha.AspNetCore;

/// <summary>
/// Requires a valid, unused Nawa Captcha pass token for <see cref="Action"/> on a controller or action.
/// The token is read from the <c>X-Nawa-Captcha-Token</c> header or the <c>nawa-captcha-token</c> form field.
/// On success the claims are available as <c>HttpContext.Items[NawaCaptchaVerifier.HttpContextItemKey]</c>.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public class RequireNawaCaptchaAttribute : Attribute, IAsyncActionFilter
{
    public RequireNawaCaptchaAttribute(string action) => Action = action;

    public string Action { get; }

    /// <summary>Acceptable challenge types for this endpoint (overrides the options). A multi-step token needs at least one.</summary>
    public string[]? AllowedTypes { get; set; }

    /// <summary>Minimum number of solved puzzles for this endpoint (0 = use the options).</summary>
    public int MinSteps { get; set; }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var requirements = AllowedTypes is null && MinSteps == 0 ? null : new NawaCaptchaRequirements(AllowedTypes, MinSteps > 0 ? MinSteps : null);
        var failure = await NawaCaptchaGate.CheckAsync(context.HttpContext, Action, requirements).ConfigureAwait(false);
        if (failure is not null)
        {
            context.Result = failure;
            return;
        }

        await next().ConfigureAwait(false);
    }
}

/// <summary>Minimal-API endpoint filter; add it with <c>.RequireNawaCaptcha(action)</c>.</summary>
public sealed class NawaCaptchaEndpointFilter : IEndpointFilter
{
    private readonly string _action;
    private readonly NawaCaptchaRequirements? _requirements;

    public NawaCaptchaEndpointFilter(string action, NawaCaptchaRequirements? requirements = null)
    {
        _action = action;
        _requirements = requirements;
    }

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var failure = await NawaCaptchaGate.CheckAsync(context.HttpContext, _action, _requirements).ConfigureAwait(false);
        return failure is not null ? failure : await next(context).ConfigureAwait(false);
    }
}

public static class NawaCaptchaEndpointExtensions
{
    /// <summary><c>app.MapPost("/login", …).RequireNawaCaptcha("login");</c></summary>
    public static TBuilder RequireNawaCaptcha<TBuilder>(this TBuilder builder, string action)
        where TBuilder : IEndpointConventionBuilder
    {
        return builder.AddEndpointFilter(new NawaCaptchaEndpointFilter(action));
    }

    /// <summary><c>app.MapPost("/pay", …).RequireNawaCaptcha("checkout", new(AllowedTypes: ["slider", "maze"], MinSteps: 2));</c></summary>
    public static TBuilder RequireNawaCaptcha<TBuilder>(this TBuilder builder, string action, NawaCaptchaRequirements requirements)
        where TBuilder : IEndpointConventionBuilder
    {
        return builder.AddEndpointFilter(new NawaCaptchaEndpointFilter(action, requirements));
    }
}

internal static class NawaCaptchaGate
{
    /// <summary>Returns null when the request may proceed, or the rejection result.</summary>
    public static async Task<ObjectResult?> CheckAsync(HttpContext http, string action, NawaCaptchaRequirements? requirements = null)
    {
        var verifier = http.RequestServices.GetRequiredService<INawaCaptchaVerifier>();
        var options = http.RequestServices.GetRequiredService<IOptions<NawaCaptchaOptions>>().Value;
        var result = await verifier.VerifyAsync(http, action, requirements, http.RequestAborted).ConfigureAwait(false);
        if (result.Success)
        {
            http.Items[NawaCaptchaVerifier.HttpContextItemKey] = result.Claims;
            return null;
        }

        http.RequestServices.GetService<ILoggerFactory>()?.CreateLogger("NawaCaptcha")
            .LogWarning("nawa-captcha rejected request: {Code} action={Action}", result.Error.ToCode(), action);

        var problem = new ProblemDetails
        {
            Status = options.RejectStatusCode,
            Title = "Captcha verification required",
            Type = "https://github.com/oriebalzyuot96/nawa-captcha#backend-validation",
        };
        problem.Extensions["code"] = result.Error.ToCode();
        return new ObjectResult(problem) { StatusCode = options.RejectStatusCode };
    }
}
