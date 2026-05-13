const express = require("express");
const Complaint = require("../models/Complaint");
const Schedule = require("../models/Schedule");
const { protect, customerOnly, adminOnly } = require("../middleware/authMiddleware");
const writeAuditLog = require("../utils/auditLogger");
const notifyUser = require("../utils/notify");

const router = express.Router();

router.post("/:scheduleId", protect, customerOnly, async (req, res) => {
    try {
        const { reason, details = "" } = req.body;
        const cleanReason = typeof reason === "string" ? reason.trim() : "";

        if (!cleanReason) {
            return res.status(400).json({ message: "Report reason is required" });
        }

        const schedule = await Schedule.findById(req.params.scheduleId);

        if (!schedule || schedule.customer?.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not your booking" });
        }

        if (!schedule.worker) {
            return res.status(400).json({ message: "No worker assigned to this booking" });
        }

        const complaint = await Complaint.create({
            schedule: schedule._id,
            customer: req.user.id,
            worker: schedule.worker,
            reason: cleanReason,
            details: typeof details === "string" ? details.trim().slice(0, 1000) : ""
        });

        await writeAuditLog(req, {
            action: "complaint.create",
            resource: "Complaint",
            resourceId: complaint._id,
            metadata: { schedule: schedule._id, reason: cleanReason }
        });

        res.status(201).json({ message: "Report sent to admin", complaint });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/admin/all", protect, adminOnly, async (req, res) => {
    try {
        const complaints = await Complaint.find({})
            .populate("customer", "name email phone")
            .populate("worker", "name email phone verificationStatus")
            .populate("schedule", "service status progressStatus finalPrice timeline")
            .sort({ createdAt: -1 });

        res.json(complaints);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/admin/:id", protect, adminOnly, async (req, res) => {
    try {
        const { status, adminNote = "" } = req.body;

        if (!["open", "reviewing", "resolved"].includes(status)) {
            return res.status(400).json({ message: "Invalid report status" });
        }

        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ message: "Report not found" });

        complaint.status = status;
        complaint.adminNote = typeof adminNote === "string" ? adminNote.trim() : "";
        if (status === "resolved") complaint.resolvedAt = new Date();

        await complaint.save();
        await notifyUser(complaint.customer, "Report updated", `Your report is now ${status}.`, { type: "complaint" });

        await writeAuditLog(req, {
            action: "complaint.update",
            resource: "Complaint",
            resourceId: complaint._id,
            metadata: { status }
        });

        res.json({ message: "Report updated", complaint });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
