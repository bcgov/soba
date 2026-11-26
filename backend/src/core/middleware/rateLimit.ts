import rateLimit, { type Options } from 'express-rate-limit';
import { ApiErrorCodes } from '@soba/lib';
import { env } from '../config/env';

const defaults: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: ApiErrorCodes.rate_limited },
};

/**
 * Global rate limiter applied to every request on the main API port.
 * Env: RATE_LIMIT_WINDOW_MS (default 60 000), RATE_LIMIT_MAX (default 100).
 */
export const globalRateLimit = rateLimit({
  ...defaults,
  windowMs: env.getRateLimitWindowMs() ?? 60_000,
  max: env.getRateLimitMax() ?? 100,
});

/**
 * Stricter limiter for authenticated / mutating API routes.
 * Env: RATE_LIMIT_API_WINDOW_MS (default 60 000), RATE_LIMIT_API_MAX (default 60).
 */
export const apiRateLimit = rateLimit({
  ...defaults,
  windowMs: env.getRateLimitApiWindowMs() ?? 60_000,
  max: env.getRateLimitApiMax() ?? 60,
});

/**
 * Limiter for document rendering (print).
 * Env: RATE_LIMIT_RENDER_WINDOW_MS (default 60 000), RATE_LIMIT_RENDER_MAX (default 30).
 */
export const renderRateLimit = rateLimit({
  ...defaults,
  windowMs: env.getRateLimitRenderWindowMs() ?? 60_000,
  max: env.getRateLimitRenderMax() ?? 30,
});

/**
 * Lenient limiter for public endpoints (health, meta, docs).
 * Env: RATE_LIMIT_PUBLIC_WINDOW_MS (default 60 000), RATE_LIMIT_PUBLIC_MAX (default 200).
 */
export const publicRateLimit = rateLimit({
  ...defaults,
  windowMs: env.getRateLimitPublicWindowMs() ?? 60_000,
  max: env.getRateLimitPublicMax() ?? 200,
});

/**
 * Integration API calls, counted per gateway consumer: every caller reaches the integration port
 * through the gateway, so a caller's address is not its own. Runs after the gateway JWT is verified
 * and before the credential lookup, so refused keys are counted too.
 * Env: RATE_LIMIT_API_WINDOW_MS (default 60 000), RATE_LIMIT_API_MAX (default 60).
 */
export const integrationConsumerRateLimit = rateLimit({
  ...defaults,
  windowMs: env.getRateLimitApiWindowMs() ?? 60_000,
  max: env.getRateLimitApiMax() ?? 60,
  keyGenerator: (req) => {
    if (!req.integrationClientId)
      throw new Error('integrationConsumerRateLimit needs a verified gateway JWT');
    return `consumer:${req.integrationClientId}`;
  },
});

/**
 * Public integration paths (health, OpenAPI, not found), counted per address. Through the gateway
 * that address is the gateway's, so all consumers share this limit; it is separate from the main
 * API's public limit. Env: RATE_LIMIT_PUBLIC_WINDOW_MS (default 60 000), RATE_LIMIT_PUBLIC_MAX
 * (default 200).
 */
export const integrationPublicRateLimit = rateLimit({
  ...defaults,
  windowMs: env.getRateLimitPublicWindowMs() ?? 60_000,
  max: env.getRateLimitPublicMax() ?? 200,
});

/**
 * Integration requests that fail gateway JWT verification, counted per address. Verified requests
 * are taken back off the count when they finish, so traffic the gateway signed does not use it.
 * Env: RATE_LIMIT_PUBLIC_WINDOW_MS (default 60 000), RATE_LIMIT_PUBLIC_MAX (default 200).
 */
export const integrationUnverifiedRateLimit = rateLimit({
  ...defaults,
  windowMs: env.getRateLimitPublicWindowMs() ?? 60_000,
  max: env.getRateLimitPublicMax() ?? 200,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req) => Boolean(req.integrationClientId),
});
