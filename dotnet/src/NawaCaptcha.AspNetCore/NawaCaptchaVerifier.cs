using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace NawaCaptcha.AspNetCore;

/// <summary>Verifies Nawa Captcha pass tokens issued by the Node server (<c>@nawa-captcha/server</c>).</summary>
public interface INawaCaptchaVerifier
{
    /// <summary>
    /// Verifies signature, expiry, max age, action, site key, allowed types, client binding, and
    /// redeems the token (single use). <paramref name="client"/> is required for bound tokens.
    /// </summary>
    Task<NawaCaptchaResult> VerifyAsync(string? token, string expectedAction, NawaCaptchaClient? client, CancellationToken cancellationToken = default);

    /// <summary>Reads the token from the configured header or form field and the client from the request, then verifies.</summary>
    Task<NawaCaptchaResult> VerifyAsync(HttpContext httpContext, string expectedAction, CancellationToken cancellationToken = default);

    /// <summary>As above, with per-route <paramref name="requirements"/> (allowed types, minimum steps) overriding the options.</summary>
    Task<NawaCaptchaResult> VerifyAsync(string? token, string expectedAction, NawaCaptchaClient? client, NawaCaptchaRequirements? requirements, CancellationToken cancellationToken = default);

    /// <summary>Reads token and client from the request, then verifies with per-route <paramref name="requirements"/>.</summary>
    Task<NawaCaptchaResult> VerifyAsync(HttpContext httpContext, string expectedAction, NawaCaptchaRequirements? requirements, CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementation mirroring the Node verifier byte for byte:
/// <list type="bullet">
/// <item>K_pass = HKDF-SHA256(ikm: UTF8(secret), salt: "nawa-guard/v1", info: "pass-token", 32 bytes)</item>
/// <item>K_bind = HKDF-SHA256(ikm: UTF8(secret), salt: "nawa-guard/v1", info: "client-binding", 32 bytes)</item>
/// <item>token = "ngp1." + kid + "." + b64url(JSON) + "." + b64url(HMAC-SHA256(K_pass, "ngp1." + kid + "." + b64url(JSON)))</item>
/// </list>
/// </summary>
#pragma warning disable CS0618 // also answers the deprecated INawaGuardVerifier for this release
public sealed partial class NawaCaptchaVerifier : INawaCaptchaVerifier, INawaGuardVerifier
#pragma warning restore CS0618
{
    public const string HttpContextItemKey = "NawaCaptcha.Claims";
    private const string Prefix = "ngp1";
    private const int MaxTokenLength = 8192;
    private const int MaxUserAgentLength = 512;
    private static readonly byte[] HkdfSalt = Encoding.UTF8.GetBytes("nawa-guard/v1");
    private static readonly string[] BindModes = { "none", "ip", "ua", "ip+ua" };

    private readonly NawaCaptchaOptions _options;
    private readonly INawaCaptchaReplayStore _replay;
    private readonly TimeProvider _time;
    private readonly Dictionary<string, (byte[] Pass, byte[] Bind)> _keys = new(StringComparer.Ordinal);

    public NawaCaptchaVerifier(IOptions<NawaCaptchaOptions> options, INawaCaptchaReplayStore replay, TimeProvider time)
    {
        _options = options.Value;
        _replay = replay;
        _time = time;
        if (_options.Secrets.Count == 0)
        {
            throw new InvalidOperationException("NawaCaptcha: configure at least one secret (NawaCaptchaOptions.Secret or Secrets).");
        }

        foreach (var name in (_options.AllowedTypes ?? new()).Concat(_options.ActionAllowedTypes.Values.SelectMany(l => l)))
        {
            if (!NawaCaptchaChallengeTypes.All.Contains(name, StringComparer.Ordinal))
            {
                throw new InvalidOperationException($"NawaCaptcha: unknown challenge type '{name}' in AllowedTypes. Known: {string.Join(", ", NawaCaptchaChallengeTypes.All)}.");
            }
        }

        foreach (var s in _options.Secrets)
        {
            if (!KidRegex().IsMatch(s.Kid))
            {
                throw new InvalidOperationException($"NawaCaptcha: invalid kid '{s.Kid}'.");
            }

            if (s.Secret.Length < 32)
            {
                throw new InvalidOperationException($"NawaCaptcha: secret for kid '{s.Kid}' must be at least 32 characters.");
            }

            var ikm = Encoding.UTF8.GetBytes(s.Secret);
            _keys[s.Kid] = (Derive(ikm, "pass-token"), Derive(ikm, "client-binding"));
        }
    }

    public Task<NawaCaptchaResult> VerifyAsync(HttpContext httpContext, string expectedAction, CancellationToken cancellationToken = default)
    {
        return VerifyAsync(ReadToken(httpContext), expectedAction, ClientOf(httpContext), null, cancellationToken);
    }

    public Task<NawaCaptchaResult> VerifyAsync(HttpContext httpContext, string expectedAction, NawaCaptchaRequirements? requirements, CancellationToken cancellationToken = default)
    {
        return VerifyAsync(ReadToken(httpContext), expectedAction, ClientOf(httpContext), requirements, cancellationToken);
    }

    public Task<NawaCaptchaResult> VerifyAsync(string? token, string expectedAction, NawaCaptchaClient? client, CancellationToken cancellationToken = default)
    {
        return VerifyAsync(token, expectedAction, client, null, cancellationToken);
    }

    public async Task<NawaCaptchaResult> VerifyAsync(string? token, string expectedAction, NawaCaptchaClient? client, NawaCaptchaRequirements? requirements, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(token))
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.MissingToken);
        }

        if (token.Length > MaxTokenLength)
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.Malformed);
        }

        var parts = token.Split('.');
        if (parts.Length != 4 || parts[0] != Prefix || !KidRegex().IsMatch(parts[1]) || !B64UrlRegex().IsMatch(parts[2]) || !B64UrlRegex().IsMatch(parts[3]))
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.Malformed);
        }

        if (!_keys.TryGetValue(parts[1], out var keys))
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.UnknownKey);
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
            return NawaCaptchaResult.Fail(NawaCaptchaError.Malformed);
        }

        // Signature first: nothing in the payload is trusted, or even parsed, before it verifies.
        var expected = HMACSHA256.HashData(keys.Pass, Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}.{parts[2]}"));
        if (!CryptographicOperations.FixedTimeEquals(expected, signature))
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.BadSignature);
        }

        PassTokenClaims? claims;
        try
        {
            claims = JsonSerializer.Deserialize<PassTokenClaims>(payload);
        }
        catch (JsonException)
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.Malformed);
        }

        if (claims is null || claims.Version != 1 || claims.Jti.Length == 0 || Array.IndexOf(BindModes, claims.BindMode) < 0 || claims.Steps is { Count: 0 or > 5 })
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.Malformed);
        }

        var now = _time.GetUtcNow().ToUnixTimeSeconds();
        if (claims.IssuedAt > now + _options.ClockSkewSeconds)
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.NotYetValid);
        }

        if (now >= claims.ExpiresAt)
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.Expired);
        }

        if (_options.MaxAgeSeconds is { } maxAge && now - claims.IssuedAt > maxAge)
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.TooOld);
        }

        if (!string.Equals(claims.Action, expectedAction, StringComparison.Ordinal))
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.ActionMismatch);
        }

        if (_options.ExpectedSiteKey is { } site && !string.Equals(claims.SiteKey, site, StringComparison.Ordinal))
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.SiteMismatch);
        }

        // Route requirement, then the per-action list, then the global list. For a multi-step token at
        // least one solved step must be allowed (the same rule as the Node verifier).
        IReadOnlyCollection<string>? allowed = requirements?.AllowedTypes
            ?? (_options.ActionAllowedTypes.TryGetValue(expectedAction, out var perAction) ? perAction : null)
            ?? _options.AllowedTypes;
        if (allowed is { Count: > 0 } && !claims.SolvedTypes.Any(t => allowed.Contains(t, StringComparer.Ordinal)))
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.TypeNotAllowed);
        }

        if ((requirements?.MinSteps ?? _options.MinSteps) is { } minSteps && claims.SolvedTypes.Count < minSteps)
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.TooFewSteps);
        }

        if (claims.BindMode != "none")
        {
            var material = client is null ? null : BindingMaterial(claims.BindMode, client);
            if (material is null || claims.Binding is null)
            {
                return NawaCaptchaResult.Fail(NawaCaptchaError.ClientMismatch);
            }

            var bind = WebEncoders.Base64UrlEncode(HMACSHA256.HashData(keys.Bind, Encoding.UTF8.GetBytes(material)));
            if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(bind), Encoding.ASCII.GetBytes(claims.Binding)))
            {
                return NawaCaptchaResult.Fail(NawaCaptchaError.ClientMismatch);
            }
        }

        var ttl = TimeSpan.FromSeconds(Math.Max(1, claims.ExpiresAt - now + _options.ClockSkewSeconds));
        if (!await _replay.TryRedeemAsync(claims.Jti, ttl, cancellationToken).ConfigureAwait(false))
        {
            return NawaCaptchaResult.Fail(NawaCaptchaError.Replayed);
        }

        return NawaCaptchaResult.Ok(claims);
    }

    /// <summary>
    /// Header first (JSON APIs), then the form field (classic posts). JSON bodies are not read. With
    /// <see cref="NawaCaptchaOptions.AcceptLegacyNames"/> the pre-rename <c>X-Nawa-Guard-Token</c> header and
    /// <c>nawa-guard-token</c> field are accepted too.
    /// </summary>
    public string? ReadToken(HttpContext httpContext)
    {
        foreach (var name in HeaderNames())
        {
            var header = httpContext.Request.Headers[name].ToString();
            if (!string.IsNullOrEmpty(header))
            {
                return header;
            }
        }

        if (httpContext.Request.HasFormContentType)
        {
            foreach (var field in FieldNames())
            {
                if (httpContext.Request.Form.TryGetValue(field, out var value) && !string.IsNullOrEmpty(value.ToString()))
                {
                    return value.ToString();
                }
            }
        }

        return null;
    }

    private IEnumerable<string> HeaderNames()
    {
        yield return _options.HeaderName;
        if (_options.AcceptLegacyNames)
        {
            yield return NawaCaptchaOptions.LegacyHeaderName;
        }
    }

    private IEnumerable<string> FieldNames()
    {
        yield return _options.FormFieldName;
        if (_options.AcceptLegacyNames)
        {
            yield return NawaCaptchaOptions.LegacyFormFieldName;
        }
    }

    /// <summary>
    /// The client as the Node server saw it. Behind a reverse proxy, run UseForwardedHeaders() first so
    /// RemoteIpAddress is the browser's address (and configure Express "trust proxy" the same way).
    /// </summary>
    public static NawaCaptchaClient ClientOf(HttpContext httpContext)
    {
        var ip = httpContext.Connection.RemoteIpAddress;
        return new NawaCaptchaClient(
            ip is null ? null : (ip.IsIPv4MappedToIPv6 ? ip.MapToIPv4() : ip).ToString(),
            httpContext.Request.Headers.UserAgent.ToString());
    }

    /// <summary>Byte-for-byte the same material as <c>bindingMaterial()</c> in <c>@nawa-captcha/server</c>.</summary>
    public static string? BindingMaterial(string mode, NawaCaptchaClient client)
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
