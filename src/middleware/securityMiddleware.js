const WINDOW_MS = 15 * 60 * 1000;

function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    next();
}

function sanitizeValue(value) {
    if (Array.isArray(value)) return value.map(sanitizeValue);

    if (value && typeof value === "object") {
        return Object.keys(value).reduce((safe, key) => {
            if (key.startsWith("$") || key.includes(".")) return safe;
            safe[key] = sanitizeValue(value[key]);
            return safe;
        }, {});
    }

    return value;
}

function sanitizeRequest(req, res, next) {
    if (req.body) req.body = sanitizeValue(req.body);
    if (req.query) req.query = sanitizeValue(req.query);
    next();
}

function createRateLimiter({ windowMs = WINDOW_MS, max = 60, message = "Too many requests. Try again later." } = {}) {
    const hits = new Map();

    return (req, res, next) => {
        const key = `${req.ip}:${req.originalUrl.split("?")[0]}`;
        const now = Date.now();
        const entry = hits.get(key) || { count: 0, resetAt: now + windowMs };

        if (entry.resetAt <= now) {
            entry.count = 0;
            entry.resetAt = now + windowMs;
        }

        entry.count += 1;
        hits.set(key, entry);

        if (entry.count > max) {
            return res.status(429).json({ message });
        }

        next();
    };
}

module.exports = {
    securityHeaders,
    sanitizeRequest,
    createRateLimiter,
};
