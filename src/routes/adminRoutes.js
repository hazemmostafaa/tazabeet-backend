const express = require("express");
const router = express.Router();
const AuditLog = require("../models/AuditLog");
const User = require("../models/user");
const notifyUser = require("../utils/notify");

const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/dashboard", protect, adminOnly, (req, res) => {
    res.json({ message: "Welcome Admin Dashboard" });
});

router.get("/audit-logs", protect, adminOnly, async (req, res) => {
    try {
        const logs = await AuditLog.find({})
            .populate("actor", "name email role")
            .sort({ createdAt: -1 })
            .limit(200);

        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/workers", protect, adminOnly, async (req, res) => {
    try {
        const workers = await User.find({ role: "worker" })
            .select("name email phone verificationStatus verificationDocs verificationNote rating totalReviews")
            .sort({ createdAt: -1 });

        res.json(workers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/workers/:id/verification", protect, adminOnly, async (req, res) => {
    try {
        const { verificationStatus, verificationNote = "" } = req.body;

        if (!["pending", "verified", "rejected", "not_submitted"].includes(verificationStatus)) {
            return res.status(400).json({ message: "Invalid verification status" });
        }

        const worker = await User.findOne({ _id: req.params.id, role: "worker" });
        if (!worker) return res.status(404).json({ message: "Worker not found" });

        worker.verificationStatus = verificationStatus;
        worker.verificationNote = typeof verificationNote === "string" ? verificationNote.trim() : "";
        await worker.save();

        await notifyUser(worker._id, "Verification updated", `Your worker verification is ${verificationStatus}.`, { type: "verification", link: "/worker-dashboard" });

        res.json({ message: "Worker verification updated", worker });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
