using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace NawaGuard.AspNetCore;

/// <summary>Verifies Nawa Guard pass tokens issued by the Node server (<c>@nawa-guard/server</c>).</summary>
public interface INawaGuardVerifier
{
    /// <summary>
    /// Verifies signature, expiry, max age, action, site key, allowed types, client binding, and
    /// redeems the token (single use). <paramref name="client"/> is required for bound tokens.
    /// </summary>
    Task<NawaGuardResult> VerifyAsync(string? token, string expectedAction, NawaGuardClient? client, CancellationToken cancellationToken = default);

    /// <summary>Reads the token from the configured header or form field and the client from the request, then verifies.</summary>
    Task<NawaGuardResult> VerifyAsync(HttpContext httpContext, string expectedAction, CancellationToken cancellationToken = default);

    /// <summary>As above, with per-route <paramref name="requirements"/> (allowed types, minimum steps) overriding the options.</summary>
    Task<NawaGuardResult> VerifyAsync(string? token, string expectedAction, NawaGuardClient? client, NawaGuardRequirements? requirements, CancellationToken cancellationToken = default);

    /// <summary>Reads token and client from the request, then verifies with per-route <paramref name="requirements"/>.</summary>
    Task<NawaGuardResult> VerifyAsync(HttpContext httpContext, string expectedAction, NawaGuardRequirements? requirements, CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementation mirroring the Node verifier byte for byte:
/// <list type="bullet">
/// <item>K_pass = HKDF-SHA256(ikm: UTF8(secret), salt: "nawa-guard/v1", info: "pass-token", 32 bytes)</item>
/// <item>K_bind = HKDF-SHA256(ikm: UTF8(secret), salt: "nawa-guard/v1", info: "client-binding", 32 bytes)</item>
/// <item>token = "ngp1." + kid + "." + b64url(JSON) + "." + b64url(HMAC-SHA256(K_pass, "ngp1." + kid + "." + b64url(JSON)))</item>
/// </list>
/// </summary>
public sealed partial class NawaGuardVerifier : INawaGuardVerifier
{
    public const string HttpContextItemKey = "NawaGuard.Claims";
    private const string Prefix = "ngp1";
    private const int MaxTokenLength = 8192;
    private const int MaxUserAgentLength = 512;
    private static readonly byte[] HkdfSalt = Encoding.UTF8.GetBytes("nawa-guard/v1");
    private static readonly string[] BindModes = { "none", "ip", "ua", "ip+ua" };

    private readonly NawaGuardOptions _options;
    private readonly INawaGuardReplayStore _replay;
    private readonly TimeProvider _time;
    private readonly Dictionary<string, (byte[] Pass, byte[] Bind)> _keys = new(StringComparer.Ordinal);

    public NawaGuardVerifier(IOptions<NawaGuardOptions> options, INawaGuardReplayStore replay, TimeProvider time)
    {
        _options = options.Value;
        _replay = replay;
        _time = time;
        if (_options.Secrets.Count == 0)
        {
            throw new InvalidOperationException("NawaGuard: configure at least one secret (NawaGuardOptions.Secret or Secrets).");
        }

        foreach (var name in (_options.AllowedTypes ?? new()).Concat(_options.ActionAllowedTypes.Values.SelectMany(l => l)))
        {
            if (!NawaGuardChallengeTypes.All.Contains(name, StringComparer.Ordinal))
            {
                throw new InvalidOperationException($"NawaGuard: unknown challenge type '{name}' in AllowedTypes. Known: {string.Join(", ", NawaGuardChallengeTypes.All)}.");
            }
        }

        foreach (var s in _options.Secrets)
        {
            if (!KidRegex().IsMatch(s.Kid))
            {
                throw new InvalidOperationException($"NawaGuard: invalid kid '{s.Kid}'.");
            }

            if (s.Secret.Length < 32)
            {
                throw new InvalidOperationException($"NawaGuard: secret for kid '{s.Kid}' must be at least 32 characters.");
            }

            var ikm = Encoding.UTF8.GetBytes(s.Secret);
            _keys[s.Kid] = (Derive(ikm, "pass-token"), Derive(ikm, "client-binding"));
        }
    }

    public Task<NawaGuardResult> VerifyAsync(HttpContext httpContext, string expectedAction, CancellationToken cancellationToken = default)
    {
        return VerifyAsync(ReadToken(httpContext), expectedAction, ClientOf(httpContext), null, cancellationToken);
    }

    public Task<NawaGuardResult> VerifyAsync(HttpContext httpContext, string expectedAction, NawaGuardRequirements? requirements, CancellationToken cancellationToken = default)
    {
        return VerifyAsync(ReadToken(httpContext), expectedAction, ClientOf(httpContext), requirements, cancellationToken);
    }

    public Task<NawaGuardResult> VerifyAsync(string? token, string expectedAction, NawaGuardClient? client, CancellationToken cancellationToken = default)
    {
        return VerifyAsync(token, expectedAction, client, null, cancellationToken);
    }

    public async Task<NawaGuardResult> VerifyAsync(string? token, string expectedAction, NawaGuardClient? client, NawaGuardRequirements? requirements, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(token))
        {
            return NawaGuardResult.Fail(NawaGuardError.MissingToken);
        }

        if (token.Length > MaxTokenLength)
        {
            return NawaGuardResult.Fail(NawaGuardError.Malformed);
        }

        var parts = token.Split('.');
        if (parts.Length != 4 || parts[0] != Prefix || !KidRegex().IsMatch(parts[1]) || !B64UrlRegex().IsMatch(parts[2]) || !B64UrlRegex().IsMatch(parts[3]))
        {
            return NawaGuardResult.Fail(NawaGuardError.Malformed);
        }

        if (!_keys.TryGetValue(parts[1], out var keys))
        {
            return NawaGuardResult.Fail(NawaGuardError.UnknownKey);
        }

        byte[] signature;
        byte[] payload;
        try
        {
            signature = WebEncoders.Base64UrlDecode(parts[3]);
            payload = WebEncoders.Base64UrlDecode(parts[2]);
        }
        catch (FormatException)
        {
            return NawaGuardResult.Fail(NawaGuardError.Malformed);
        }

        // Signature first: nothing in the payload is trusted, or even parsed, before it verifies.
        var expected = HMACSHA256.HashData(keys.Pass, Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}.{parts[2]}"));
        if (!CryptographicOperations.FixedTimeEquals(expected, signature))
        {
            return NawaGuardResult.Fail(NawaGuardError.BadSignature);
        }

        PassTokenClaims? claims;
        try
        {
            claims = JsonSerializer.Deserialize<PassTokenClaims>(payload);
        }
        catch (JsonException)
        {
            return NawaGuardResult.Fail(NawaGuardError.Malformed);
        }

        if (claims is null || claims.Version != 1 || claims.Jti.Length == 0 || Array.IndexOf(BindModes, claims.BindMode) < 0 || claims.Steps is { Count: 0 or > 5 })
        {
            return NawaGuardResult.Fail(NawaGuardError.Malformed);
        }

        var now = _time.GetUtcNow().ToUnixTimeSeconds();
        if (claims.IssuedAt > now + _options.ClockSkewSeconds)
        {
            return NawaGuardResult.Fail(NawaGuardError.NotYetValid);
        }

        if (now >= claims.ExpiresAt)
        {
            return NawaGuardResult.Fail(NawaGuardError.Expired);
        }

        if (_options.MaxAgeSeconds is { } maxAge && now - claims.IssuedAt > maxAge)
        {
            return NawaGuardResult.Fail(NawaGuardError.TooOld);
        }

        if (!string.Equals(claims.Action, expectedAction, StringComparison.Ordinal))
        {
            return NawaGuardResult.Fail(NawaGuardError.ActionMismatch);
        }

        if (_options.ExpectedSiteKey is { } site && !string.Equals(claims.SiteKey, site, StringComparison.Ordinal))
        {
            return NawaGuardResult.Fail(NawaGuardError.SiteMismatch);
        }

        // Route requirement, then the per-action list, then the global list. For a multi-step token at
        // least one solved step must be allowed (the same rule as the Node verifier).
        IReadOnlyCollection<string>? allowed = requirements?.AllowedTypes
            ?? (_options.ActionAllowedTypes.TryGetValue(expectedAction, out var perAction) ? perAction : null)
            ?? _options.AllowedTypes;
        if (allowed is { Count: > 0 } && !claims.SolvedTypes.Any(t => allowed.Contains(t, StringComparer.Ordinal)))
        {
            return NawaGuardResult.Fail(NawaGuardError.TypeNotAllowed);
        }

        if ((requirements?.MinSteps ?? _options.MinSteps) is { } minSteps && claims.SolvedTypes.Count < minSteps)
        {
            return NawaGuardResult.Fail(NawaGuardError.TooFewSteps);
        }

        if (claims.BindMode != "none")
        {
            var material = client is null ? null : BindingMaterial(claims.BindMode, client);
            if (material is null || claims.Binding is null)
            {
                return NawaGuardResult.Fail(NawaGuardError.ClientMismatch);
            }

            var bind = WebEncoders.Base64UrlEncode(HMACSHA256.HashData(keys.Bind, Encoding.UTF8.GetBytes(material)));
            if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(bind), Encoding.ASCII.GetBytes(claims.Binding)))
            {
                return NawaGuardResult.Fail(NawaGuardError.ClientMismatch);
            }
        }

        var ttl = TimeSpan.FromSeconds(Math.Max(1, claims.ExpiresAt - now + _options.ClockSkewSeconds));
        if (!await _replay.TryRedeemAsync(claims.Jti, ttl, cancellationToken).ConfigureAwait(false))
        {
            return NawaGuardResult.Fail(NawaGuardError.Replayed);
        }

        return NawaGuardResult.Ok(claims);
    }

    /// <summary>Header first (JSON APIs), then the form field (classic posts). JSON bodies are not read.</summary>
    public string? ReadToken(HttpContext httpContext)
    {
        var header = httpContext.Request.Headers[_options.HeaderName].ToString();
        if (!string.IsNullOrEmpty(header))
        {
            return header;
        }

        if (httpContext.Request.HasFormContentType && httpContext.Request.Form.TryGetValue(_options.FormFieldName, out var value))
        {
            return value.ToString();
        }

        return null;
    }

    /// <summary>
    /// The client as the Node server saw it. Behind a reverse proxy, run UseForwardedHeaders() first so
    /// RemoteIpAddress is the browser's address (and configure Express "trust proxy" the same way).
    /// </summary>
    public static NawaGuardClient ClientOf(HttpContext httpContext)
    {
        var ip = httpContext.Connection.RemoteIpAddress;
        return new NawaGuardClient(
            ip is null ? null : (ip.IsIPv4MappedToIPv6 ? ip.MapToIPv4() : ip).ToString(),
            httpContext.Request.Headers.UserAgent.ToString());
    }

    /// <summary>Byte-for-byte the same material as <c>bindingMaterial()</c> in <c>@nawa-guard/server</c>.</summary>
    public static string? BindingMaterial(string mode, NawaGuardClient client)
    {
        var ip = NormalizeIp(client.Ip);
        var ua = (client.UserAgent ?? string.Empty).Trim();
        if (ua.Length > MaxUserAgentLength)
        {
            ua = ua[..MaxUserAgentLength];
        }

        return mode switch
        {
            "ip" => ip.Length > 0 ? $"ip={ip}" : null,
            "ua" => ua.Length > 0 ? $"ua={ua}" : null,
            "ip+ua" => ip.Length > 0 && ua.Length > 0 ? $"ip={ip}\nua={ua}" : null,
            _ => null,
        };
    }

    public static string NormalizeIp(string? ip)
    {
        if (string.IsNullOrWhiteSpace(ip))
        {
            return string.Empty;
        }

        var value = ip.Trim().ToLowerInvariant();
        if (value.StartsWith("::ffff:", StringComparison.Ordinal) && value.Contains('.'))
        {
            value = value[7..];
        }

        return value;
    }

    private static byte[] Derive(byte[] ikm, string info) =>
        HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, 32, HkdfSalt, Encoding.UTF8.GetBytes(info));

    [GeneratedRegex("^[A-Za-z0-9_-]{1,16}$")]
    private static partial Regex KidRegex();

    [GeneratedRegex("^[A-Za-z0-9_-]+$")]
    private static partial Regex B64UrlRegex();
}
