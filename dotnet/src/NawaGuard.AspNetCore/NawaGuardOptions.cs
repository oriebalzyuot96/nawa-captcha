using Microsoft.AspNetCore.Http;

namespace NawaGuard.AspNetCore;

/// <summary>A signing secret with its key id. The first entry is the active one; all are accepted for verification.</summary>
public sealed class NawaGuardSecret
{
    public NawaGuardSecret()
    {
    }

    public NawaGuardSecret(string kid, string secret)
    {
        Kid = kid;
        Secret = secret;
    }

    /// <summary>1-16 characters of [A-Za-z0-9_-]; must match the kid configured on the Node server.</summary>
    public string Kid { get; set; } = "k1";

    /// <summary>The same secret the Node server uses (at least 32 characters). Load it from a secret store.</summary>
    public string Secret { get; set; } = string.Empty;
}

/// <summary>Options for <see cref="INawaGuardVerifier"/> and the request filters.</summary>
public sealed class NawaGuardOptions
{
    /// <summary>Secrets shared with the Node server. List several during rotation.</summary>
    public List<NawaGuardSecret> Secrets { get; set; } = new();

    /// <summary>Convenience for a single secret with kid "k1" (the Node default when passing a plain string).</summary>
    public string? Secret
    {
        get => Secrets.FirstOrDefault()?.Secret;
        set => Secrets = value is null ? new() : new() { new NawaGuardSecret("k1", value) };
    }

    /// <summary>When set, tokens issued for another site key are rejected.</summary>
    public string? ExpectedSiteKey { get; set; }

    /// <summary>Reject tokens issued longer ago than this, even if their own expiry is later.</summary>
    public int? MaxAgeSeconds { get; set; }

    /// <summary>Tolerated clock difference between the Node server and this one.</summary>
    public int ClockSkewSeconds { get; set; } = 5;

    /// <summary>
    /// Restrict which challenge types are acceptable (e.g. exclude "pow" for sensitive actions). For a multi-step
    /// token at least one solved step must be in the list. Names are validated against <see cref="NawaGuardChallengeTypes.All"/>.
    /// </summary>
    public List<string>? AllowedTypes { get; set; }

    /// <summary>
    /// Per-action allowed types, mirroring the Node server's <c>perAction</c> option, e.g.
    /// <c>NawaGuard__ActionAllowedTypes__login__0=slider</c>. Overrides <see cref="AllowedTypes"/> for that action.
    /// </summary>
    public Dictionary<string, List<string>> ActionAllowedTypes { get; set; } = new(StringComparer.Ordinal);

    /// <summary>Require at least this many solved puzzles (the Node server's <c>steps</c> option). Default: no requirement.</summary>
    public int? MinSteps { get; set; }

    /// <summary>Header carrying the pass token for JSON APIs.</summary>
    public string HeaderName { get; set; } = "X-Nawa-Guard-Token";

    /// <summary>Form field carrying the pass token for classic form posts.</summary>
    public string FormFieldName { get; set; } = "nawa-guard-token";

    /// <summary>Status code returned by the filters when verification fails.</summary>
    public int RejectStatusCode { get; set; } = StatusCodes.Status403Forbidden;
}
