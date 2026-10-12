export {
  NawaGuard,
  createNawaGuard,
  verifyPassToken,
  type AdaptiveOptions,
  type ChallengeError,
  type ChallengeRequest,
  type ChallengeResponse,
  type GuardEvent,
  type NawaGuardOptions,
  type PassTokenError,
  type PassTokenResult,
  type PublicVerifyError,
  type RateLimitHook,
  type RateLimitOptions,
  type VerifyFailure,
  type VerifyPassTokenOptions,
  type VerifyRequest,
  type VerifyResult,
} from './engine.js';
export { MemoryStore, ioredisStore, nodeRedisStore, type IoRedisLike, type MemoryStoreOptions, type NawaGuardStore, type NodeRedisLike } from './store.js';
export { createKeyring, deriveKey, HKDF_SALT, type Keyring, type SecretEntry } from './crypto.js';
export { bindingHash, bindingMaterial, normalizeIp, type BindMode, type ClientInfo } from './binding.js';
export { openChallenge, parsePassToken, sealChallenge, signPassToken, type ChallengeClaims, type PassTokenClaims } from './tokens.js';
export { analyzeTrajectory, entropy, type TrajectoryVerdict } from './heuristics.js';
export {
  DEFAULT_TOKEN_FIELD,
  DEFAULT_TOKEN_HEADER,
  SECURITY_HEADERS,
  checkPassToken,
  handleChallenge,
  handleVerify,
  readPassToken,
  type GuardHttpRequest,
  type GuardHttpResponse,
  type PassTokenSource,
  type ProtectOptions,
} from './http.js';
export * from './puzzles/index.js';
export * from './types.js';
