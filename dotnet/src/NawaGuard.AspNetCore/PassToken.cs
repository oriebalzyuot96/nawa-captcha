using System.Text.Json.Serialization;

namespace NawaGuard.AspNetCore;

/// <summary>Claims inside a pass token (<c>ngp1.&lt;kid&gt;.&lt;payload&gt;.&lt;sig&gt;</c>). See README "Token format".</summary>
public sealed record PassTokenClaims
{
    [JsonPropertyName("v")] public int Version { get; init; }

    [JsonPropertyName("jti")] public string Jti { get; init; } = string.Empty;

    [JsonPropertyName("sk")] public string SiteKey { get; init; } = string.Empty;

    [JsonPropertyName("act")] public string Action { get; init; } = string.Empty;

    /// <summary>Challenge type that was solved: slider, rotate, icons, math, order, trace, pow, accessible.</summary>
    [JsonPropertyName("typ")] public string Type { get; init; } = string.Empty;

    [JsonPropertyName("lvl")] public int Level { get; init; }

    /// <summary>Issued at, unix seconds.</summary>
    [JsonPropertyName("iat")] public long IssuedAt { get; init; }

    /// <summary>Expiry, unix seconds.</summary>
    [JsonPropertyName("exp")] public long ExpiresAt { get; init; }

    /// <summary>Client binding mode: none, ip, ua, ip+ua.</summary>
    [JsonPropertyName("cbm")] public string BindMode { get; init; } = "none";

    [JsonPropertyName("cb")] public string? Binding { get; init; }
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
