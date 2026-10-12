using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace NawaGuard.AspNetCore;

/// <summary>
/// Requires a valid, unused Nawa Guard pass token for <see cref="Action"/> on a controller or action.
/// The token is read from the <c>X-Nawa-Guard-Token</c> header or the <c>nawa-guard-token</c> form field.
/// On success the claims are available as <c>HttpContext.Items[NawaGuardVerifier.HttpContextItemKey]</c>.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequireNawaGuardAttribute : Attribute, IAsyncActionFilter
{
    public RequireNawaGuardAttribute(string action) => Action = action;

    public string Action { get; }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var failure = await NawaGuardGate.CheckAsync(context.HttpContext, Action).ConfigureAwait(false);
        if (failure is not null)
        {
            context.Result = failure;
            return;
        }

        await next().ConfigureAwait(false);
    }
}

/// <summary>Minimal-API endpoint filter; add it with <see cref="NawaGuardEndpointExtensions.RequireNawaGuard{TBuilder}"/>.</summary>
public sealed class NawaGuardEndpointFilter : IEndpointFilter
{
    private readonly string _action;

    public NawaGuardEndpointFilter(string action) => _action = action;

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var failure = await NawaGuardGate.CheckAsync(context.HttpContext, _action).ConfigureAwait(false);
        return failure is not null ? failure : await next(context).ConfigureAwait(false);
    }
}

public static class NawaGuardEndpointExtensions
{
    /// <summary><c>app.MapPost("/login", …).RequireNawaGuard("login");</c></summary>
    public static TBuilder RequireNawaGuard<TBuilder>(this TBuilder builder, string action)
        where TBuilder : IEndpointConventionBuilder
    {
        return builder.AddEndpointFilter(new NawaGuardEndpointFilter(action));
    }
}

internal static class NawaGuardGate
{
    /// <summary>Returns null when the request may proceed, or the rejection result.</summary>
    public static async Task<ObjectResult?> CheckAsync(HttpContext http, string action)
    {
        var verifier = http.RequestServices.GetRequiredService<INawaGuardVerifier>();
        var options = http.RequestServices.GetRequiredService<IOptions<NawaGuardOptions>>().Value;
        var result = await verifier.VerifyAsync(http, action, http.RequestAborted).ConfigureAwait(false);
        if (result.Success)
        {
            http.Items[NawaGuardVerifier.HttpContextItemKey] = result.Claims;
            return null;
        }

        http.RequestServices.GetService<ILoggerFactory>()?.CreateLogger("NawaGuard")
            .LogWarning("nawa-guard rejected request: {Code} action={Action}", result.Error.ToCode(), action);

        var problem = new ProblemDetails
        {
            Status = options.RejectStatusCode,
            Title = "Captcha verification required",
            Type = "https://github.com/nawa-guard/nawa-guard#errors",
        };
        problem.Extensions["code"] = result.Error.ToCode();
        return new ObjectResult(problem) { StatusCode = options.RejectStatusCode };
    }
}
