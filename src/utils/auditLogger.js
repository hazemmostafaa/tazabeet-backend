const crypto = require("crypto");
const AuditLog = require("../models/AuditLog");

async function writeAuditLog(req, { action, resource, resourceId = "", metadata = {} }) {
    try {
        const previous = await AuditLog.findOne().sort({ createdAt: -1 }).select("hash").lean();
        const payload = {
            actor: req.user?.id || null,
            role: req.user?.role || "guest",
            action,
            resource,
            resourceId: resourceId ? String(resourceId) : "",
            ip: req.ip,
            userAgent: req.get("user-agent") || "",
            metadata,
            previousHash: previous?.hash || "",
        };

        const hash = crypto
            .createHash("sha256")
            .update(JSON.stringify(payload))
            .digest("hex");

        await AuditLog.create({ ...payload, hash });
    } catch (err) {
        console.log("AUDIT LOG ERROR:", err.message);
    }
}

module.exports = writeAuditLog;
