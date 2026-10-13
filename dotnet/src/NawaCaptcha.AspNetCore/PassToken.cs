using System.Text.Json.Serialization;

namespace NawaCaptcha.AspNetCore;

/// <summary>Claims inside a pass token (<c>ngp1.&lt;kid&gt;.&lt;payload&gt;.&lt;sig&gt;</c>). See README "Token format".</summary>
public sealed record PassTokenClaims
{
    [JsonPropertyName("v")] public int Version { get; init; }

    [JsonPropertyName("jti")] public string Jti { get; init; } = string.Empty;

    [JsonPropertyName("sk")] public string SiteKey { get; init; } = string.Empty;

    [JsonPropertyName("act")] public string Action { get; init; } = string.Empty;

    /// <summary>Challenge type that was solved (the last one for multi-step tokens). See <see cref="NawaCaptchaChallengeTypes.All"/>.</summary>
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

/// <summary>Why a pass token was rejected. <see cref="NawaCaptchaErrorCodes.ToCode"/> gives the same codes as the Node library.</summary>
public enum NawaCaptchaError
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

public static class NawaCaptchaErrorCodes
{
    public static string ToCode(this NawaCaptchaError error) => error switch
    {
        NawaCaptchaError.None => "none",
        NawaCaptchaError.MissingToken => "missing-token",
        NawaCaptchaError.Malformed => "malformed",
        NawaCaptchaError.UnknownKey => "unknown-key",
        NawaCaptchaError.BadSignature => "bad-signature",
        NawaCaptchaError.Expired => "expired",
        NawaCaptchaError.NotYetValid => "not-yet-valid",
        NawaCaptchaError.TooOld => "too-old",
        NawaCaptchaError.ActionMismatch => "action-mismatch",
        NawaCaptchaError.SiteMismatch => "site-mismatch",
        NawaCaptchaError.TypeNotAllowed => "type-not-allowed",
        NawaCaptchaError.TooFewSteps => "too-few-steps",
        NawaCaptchaError.ClientMismatch => "client-mismatch",
        NawaCaptchaError.Replayed => "replayed",
        _ => "unknown",
    };
}

/// <summary>Outcome of a verification.</summary>
public sealed record NawaCaptchaResult(bool Success, NawaCaptchaError Error, PassTokenClaims? Claims)
{
    public static NawaCaptchaResult Fail(NawaCaptchaError error) => new(false, error, null);

    public static NawaCaptchaResult Ok(PassTokenClaims claims) => new(true, NawaCaptchaError.None, claims);
}

/// <summary>The request attributes a token may be bound to.</summary>
public sealed record NawaCaptchaClient(string? Ip, string? UserAgent);

/// <summary>Per-route requirements that override <see cref="NawaCaptchaOptions"/> for one verification.</summary>
/// <param name="AllowedTypes">Acceptable challenge types; a multi-step token passes if at least one solved step is listed.</param>
/// <param name="MinSteps">Minimum number of solved puzzles (multi-step tokens).</param>
public sealed record NawaCaptchaRequirements(IReadOnlyCollection<string>? AllowedTypes = null, int? MinSteps = null);

/// <summary>Every challenge type the Node server can issue (mirrors <c>CHALLENGE_TYPES</c> in <c>@nawa-captcha/server</c>).</summary>
public static class NawaCaptchaChallengeTypes
{
    public static readonly IReadOnlyList<string> All = new[]
    {
        "slider", "slide-unlock", "shadow-drag", "jigsaw", "rotate", "rotate-object", "rotate-match", "hold",
        "icons", "icons-weather", "icons-objects", "odd-one-out", "odd-rotation", "color-name", "biggest", "find-shape",
        "shadow-pick", "pattern", "clock", "math-compare", "symmetry", "pairs", "tap-order", "spell",
        "order", "order-size", "order-numbers", "order-time", "story", "trace", "trace-letters", "maze",
        "math", "count", "dice", "pow", "accessible", "audio",
    };

    /// <summary>Weak or machine-readable types you may want to exclude on sensitive routes.</summary>
    public static readonly IReadOnlyList<string> LowAssurance = new[] { "pow", "accessible", "audio", "math", "hold", "count", "dice" };
}
