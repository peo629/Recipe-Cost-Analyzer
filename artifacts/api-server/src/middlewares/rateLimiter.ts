import rateLimit from "express-rate-limit";
import type { Request } from "express";

export const openaiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many AI generation requests. Please wait before trying again.",
  },
  keyGenerator: (req: Request) => {
    if (req.isAuthenticated()) {
      return `user:${req.user.id}`;
    }
    return `anon:unknown`;
  },
});
