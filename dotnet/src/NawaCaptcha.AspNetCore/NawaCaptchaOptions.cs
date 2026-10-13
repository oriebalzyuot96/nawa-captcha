using Microsoft.AspNetCore.Http;

namespace NawaCaptcha.AspNetCore;

/// <summary>A signing secret with its key id. The first entry is the active one; all are accepted for verification.</summary>
public sealed class NawaCaptchaSecret
{
    public NawaCaptchaSecret()
    {
    }

    public NawaCaptchaSecret(string kid, string secret)
    {
        Kid = kid;
        Secret = secret;
    }

    /// <summary>1-16 characters of [A-Za-z0-9_-]; must match the kid configured on the Node server.</summary>
    public string Kid { get; set; } = "k1";

    /// <summary>The same secret the Node server uses (at least 32 characters). Load it from a secret store.</summary>
    public string Secret { get; set; } = string.Empty;
}

/// <summary>Options for <see cref="INawaCaptchaVerifier"/> and the request filters.</summary>
public sealed class NawaCaptchaOptions
{
    /// <summary>Secrets shared with the Node server. List several during rotation.</summary>
    public List<NawaCaptchaSecret> Secrets { get; set; } = new();

    /// <summary>Convenience for a single secret with kid "k1" (the Node default when passing a plain string).</summary>
    public string? Secret
    {
        get => Secrets.FirstOrDefault()?.Secret;
        set => Secrets = value is null ? new() : new() { new NawaCaptchaSecret("k1", value) };
    }

    /// <summary>When set, tokens issued for another site key are rejected.</summary>
    public string? ExpectedSiteKey { get; set; }

    /// <summary>Reject tokens issued longer ago than this, even if their own expiry is later.</summary>
    public int? MaxAgeSeconds { get; set; }

    /// <summary>Tolerated clock difference between the Node server and this one.</summary>
    public int ClockSkewSeconds { get; set; } = 5;

    /// <summary>
    /// Restrict which challenge types are acceptable (e.g. exclude "pow" for sensitive actions). For a multi-step
    /// token at least one solved step must be in the list. Names are validated against <see cref="NawaCaptchaChallengeTypes.All"/>.
    /// </summary>
    public List<string>? AllowedTypes { get; set; }

    /// <summary>
    /// Per-action allowed types, mirroring the Node server's <c>perAction</c> option, e.g.
    /// <c>NawaCaptcha__ActionAllowedTypes__login__0=slider</c>. Overrides <see cref="AllowedTypes"/> for that action.
    /// </summary>
    public Dictionary<string, List<string>> ActionAllowedTypes { get; set; } = new(StringComparer.Ordinal);

    /// <summary>Require at least this many solved puzzles (the Node server's <c>steps</c> option). Default: no requirement.</summary>
    public int? MinSteps { get; set; }

    /// <summary>Header carrying the pass token for JSON APIs.</summary>
    public string HeaderName { get; set; } = "X-Nawa-Captcha-Token";

    /// <summary>Form field carrying the pass token for classic form posts.</summary>
    public string FormFieldName { get; set; } = "nawa-captcha-token";

    /// <summary>
    /// Also accept the pre-rename (Nawa Guard) <see cref="LegacyHeaderName"/> header and
    /// <see cref="LegacyFormFieldName"/> field. Default true for this release.
    /// </summary>
    public bool AcceptLegacyNames { get; set; } = true;

    /// <summary>Deprecated header name from before the rename to Nawa Captcha.</summary>
    public const string LegacyHeaderName = "X-Nawa-Guard-Token";

    /// <summary>Deprecated form field name from before the rename to Nawa Captcha.</summary>
    public const string LegacyFormFieldName = "nawa-guard-token";

    /// <summary>Status code returned by the filters when verification fails.</summary>
    public int RejectStatusCode { get; set; } = StatusCodes.Status403Forbidden;
}
