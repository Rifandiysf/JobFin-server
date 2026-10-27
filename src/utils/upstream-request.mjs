import { setTimeout as delay } from "node:timers/promises";
import { mapConfig } from "../config/map.config.mjs";
import { AppError } from "./app-error.mjs";

const RETRYABLE_HTTP_STATUS_CODES = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 1500;
const MAX_RETRY_DELAY_MS = 5000;

class UpstreamError extends AppError {
  constructor(serviceName, { isRetryable, retryAfterMs, detail }) {
    super(
      `The ${serviceName} is temporarily unavailable. Please try again later.`,
      503,
      "MAP_SERVICE_UNAVAILABLE"
    );
    this.name = "UpstreamError";
    this.isRetryable = isRetryable;
    this.retryAfterMs = retryAfterMs;
    this.detail = detail;
  }
}

function parseRetryAfterMs(response) {
  const retryAfterSeconds = Number(response.headers.get("retry-after"));

  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 0) return undefined;

  return Math.min(retryAfterSeconds * 1000, MAX_RETRY_DELAY_MS);
}

async function fetchJsonOnce({ url, headers, serviceName }) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), mapConfig.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": mapConfig.userAgent,
        Accept: "application/json",
        ...headers,
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new UpstreamError(serviceName, {
        isRetryable: RETRYABLE_HTTP_STATUS_CODES.has(response.status),
        retryAfterMs: parseRetryAfterMs(response),
        detail: `HTTP ${response.status}`,
      });
    }

    return await response.json();
  } catch (error) {
    if (error instanceof UpstreamError) throw error;

    throw new UpstreamError(serviceName, {
      isRetryable: true,
      detail: error.name === "AbortError" ? "request timed out" : error.message,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestJson({ url, throttle, serviceName, headers = {} }) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await throttle.schedule(() => fetchJsonOnce({ url, headers, serviceName }));
    } catch (error) {
      lastError = error;

      if (!(error instanceof UpstreamError)) throw error;

      console.warn(`[map] ${serviceName} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.detail}`);

      if (!error.isRetryable || attempt === MAX_ATTEMPTS) break;

      await delay(error.retryAfterMs ?? DEFAULT_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

export { requestJson, UpstreamError };
