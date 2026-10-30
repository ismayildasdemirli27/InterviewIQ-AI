import rateLimit from "express-rate-limit";

const isLocalhost = (ip?: string): boolean => {
  return (
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.includes("127.0.0.1")
  );
};

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000, // Generous limit for real-time AI & dashboard polling
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isLocalhost(req.ip),
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Allows normal user authentication & testing without lockouts
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isLocalhost(req.ip),
  message: {
    success: false,
    message: "Too many attempts. Please try again later.",
  },
});
