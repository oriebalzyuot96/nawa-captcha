using System.Text.Json.Serialization;

namespace NawaGuard.AspNetCore;

/// <summary>Claims inside a pass token (<c>ngp1.&lt;kid&gt;.&lt;payload&gt;.&lt;sig&gt;</c>). See README "Token format".</summary>
public sealed record PassTokenClaims
{
    [JsonPropertyName("v")] public int Version { get; init; }

    [JsonPropertyName("jti")] public string Jti { get; init; } = string.Empty;

    [JsonPropertyName("sk")] public string SiteKey { get; init; } = string.Empty;

    [JsonPropertyName("act")] public string Action { get; init; } = string.Empty;

    /// <summary>Challenge type that was solved (the last one for multi-step tokens). See <see cref="NawaGuardChallengeTypes.All"/>.</summary>
    [JsonPropertyName("typ")] public string Type { get; init; } = string.Empty;

    [JsonPropertyName("lvl")] public int Level { get; init; }

    /// <summary>Issued at, unix seconds.</summary>
    [JsonPropertyName("iat")] public long IssuedAt { get; init; }

    /// <summary>Expiry, unix seconds.</summary>
    [JsonPropertyName("exp")] public long ExpiresAt { get; init; }

    /// <summary>Client binding mode: none, ip, ua, ip+ua.</summary>
    [JsonPropertyName("cbm")] public string BindMode { get; init; } = "none";

    [JsonPropertyName("cb")] public string? Binding { get; init; }

    /// <summary>Multi-step tokens only: every solved type in order (<see cref="Type"/> is the last). Absent for single puzzles.</summary>
    [JsonPropertyName("stp")] public IReadOnlyList<string>? Steps { get; init; }

    /// <summary>The solved types: <see cref="Steps"/>, or just <see cref="Type"/> for a single puzzle.</summary>
    [JsonIgnore] public IReadOnlyList<string> SolvedTypes => Steps is { Count: > 0 } steps ? steps : new[] { Type };
}

/// <summary>Why a pass token was rejected. <see cref="NawaGuardErrorCodes.ToCode"/> gives the same codes as the Node library.</summary>
public enum NawaGuardError
{
    None,
    MissingToken,
    Malformed,
    UnknownKey,
    BadSignature,
    Expired,
    NotYetValid,
    TooOld,
    ActionMismatch,
    SiteMismatch,
    TypeNotAllowed,
    TooFewSteps,
    ClientMismatch,
    Replayed,
}

public static class NawaGuardErrorCodes
{
    public static string ToCode(this NawaGuardError error) => error switch
    {
        NawaGuardError.None => "none",
        NawaGuardError.MissingToken => "missing-token",
        NawaGuardError.Malformed => "malformed",
        NawaGuardError.UnknownKey => "unknown-key",
        NawaGuardError.BadSignature => "bad-signature",
        NawaGuardError.Expired => "expired",
        NawaGuardError.NotYetValid => "not-yet-valid",
        NawaGuardError.TooOld => "too-old",
        NawaGuardError.ActionMismatch => "action-mismatch",
        NawaGuardError.SiteMismatch => "site-mismatch",
        NawaGuardError.TypeNotAllowed => "type-not-allowed",
        NawaGuardError.TooFewSteps => "too-few-steps",
        NawaGuardError.ClientMismatch => "client-mismatch",
        NawaGuardError.Replayed => "replayed",
        _ => "unknown",
    };
}

/// <summary>Outcome of a verification.</summary>
public sealed record NawaGuardResult(bool Success, NawaGuardError Error, PassTokenClaims? Claims)
{
    public static NawaGuardResult Fail(NawaGuardError error) => new(false, error, null);

    public static NawaGuardResult Ok(PassTokenClaims claims) => new(true, NawaGuardError.None, claims);
}

/// <summary>The request attributes a token may be bound to.</summary>
public sealed record NawaGuardClient(string? Ip, string? UserAgent);

/// <summary>Per-route requirements that override <see cref="NawaGuardOptions"/> for one verification.</summary>
/// <param name="AllowedTypes">Acceptable challenge types; a multi-step token passes if at least one solved step is listed.</param>
/// <param name="MinSteps">Minimum number of solved puzzles (multi-step tokens).</param>
public sealed record NawaGuardRequirements(IReadOnlyCollection<string>? AllowedTypes = null, int? MinSteps = null);

/// <summary>Every challenge type the Node server can issue (mirrors <c>CHALLENGE_TYPES</c> in <c>@nawa-guard/server</c>).</summary>
public static class NawaGuardChallengeTypes
{
    public static readonly IReadOnlyList<string> All = new[]
    {
        "slider", "slide-unlock", "shadow-drag", "jigsaw", "rotate", "rotate-object", "rotate-match", "hold",
        "icons", "icons-weather", "icons-objects", "odd-one-out", "odd-rotation", "color-name", "biggest", "find-shape",
        "shadow-pick", "pattern", "clock", "math-compare", "symmetry", "pairs", "tap-order", "spell",
        "order", "order-size", "order-numbers", "order-time", "story", "trace", "trace-letters", "maze",
        "math", "count", "dice", "pow", "accessible",
    };

    /// <summary>Weak or machine-readable types you may want to exclude on sensitive routes.</summary>
    public static readonly IReadOnlyList<string> LowAssurance = new[] { "pow", "accessible", "math", "hold", "count", "dice" };
}
