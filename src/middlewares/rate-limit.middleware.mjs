import { rateLimit } from "express-rate-limit";
import { error as sendErrorResponse } from "../utils/response.mjs";

const MINUTE_IN_MS = 60 * 1000;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;

function createUserRateLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user.id),
    handler: (req, res) => sendErrorResponse(res, 429, message),
  });
}

const jobWriteLimiter = createUserRateLimiter({
  windowMs: MINUTE_IN_MS,
  limit: 30,
  message: "Too many requests. Please wait a minute before saving more applications.",
});

const homeAddressLimiter = createUserRateLimiter({
  windowMs: HOUR_IN_MS,
  limit: 5,
  message: "Too many home address changes. Please try again in an hour.",
});

const routeRefreshLimiter = createUserRateLimiter({
  windowMs: HOUR_IN_MS,
  limit: 10,
  message: "Too many route refresh requests. Please try again in an hour.",
});

export { createUserRateLimiter, jobWriteLimiter, homeAddressLimiter, routeRefreshLimiter };
