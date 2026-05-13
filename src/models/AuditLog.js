const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        role: String,
        action: {
            type: String,
            required: true
        },
        resource: {
            type: String,
            required: true
        },
        resourceId: String,
        ip: String,
        userAgent: String,
        metadata: mongoose.Schema.Types.Mixed,
        previousHash: String,
        hash: {
            type: String,
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
