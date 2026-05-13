const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const Schedule = require("../models/Schedule");
const { protect, workerOnly, customerOnly, adminOnly } = require("../middleware/authMiddleware");
const writeAuditLog = require("../utils/auditLogger");

const MAX_MESSAGE_LENGTH = 1000;

function populateMessage(query) {
    return query
        .populate("customer", "name phone")
        .populate("worker", "name phone")
        .populate("sender", "name role")
        .populate("schedule", "service date startTime status");
}

router.get("/worker", protect, workerOnly, async (req, res) => {
    try {
        const messages = await populateMessage(
            Message.find({ worker: req.user.id }).sort({ createdAt: 1 })
        );

        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/customer/:scheduleId", protect, customerOnly, async (req, res) => {
    try {
        const schedule = await Schedule.findById(req.params.scheduleId);

        if (!schedule || schedule.customer?.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const messages = await populateMessage(
            Message.find({
                schedule: schedule._id,
                customer: req.user.id
            }).sort({ createdAt: 1 })
        );

        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/customer/:scheduleId", protect, customerOnly, async (req, res) => {
    try {
        const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

        if (!text) {
            return res.status(400).json({ message: "Message is required" });
        }

        if (text.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ message: "Message is too long" });
        }

        const schedule = await Schedule.findById(req.params.scheduleId);

        if (!schedule || schedule.customer?.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        if (!schedule.worker || !["confirmed", "completed"].includes(schedule.status)) {
            return res.status(400).json({ message: "No worker assigned" });
        }

        const message = await Message.create({
            schedule: schedule._id,
            customer: req.user.id,
            worker: schedule.worker,
            sender: req.user.id,
            text
        });

        const populated = await populateMessage(Message.findById(message._id));
        await writeAuditLog(req, {
            action: "message.customer_send",
            resource: "Message",
            resourceId: message._id,
            metadata: { schedule: schedule._id }
        });
        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/worker/:scheduleId", protect, workerOnly, async (req, res) => {
    try {
        const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

        if (!text) {
            return res.status(400).json({ message: "Message is required" });
        }

        if (text.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ message: "Message is too long" });
        }

        const schedule = await Schedule.findById(req.params.scheduleId);

        if (!schedule || schedule.worker?.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        if (!schedule.customer || !["confirmed", "completed"].includes(schedule.status)) {
            return res.status(400).json({ message: "No customer assigned" });
        }

        const message = await Message.create({
            schedule: schedule._id,
            customer: schedule.customer,
            worker: req.user.id,
            sender: req.user.id,
            text
        });

        const populated = await populateMessage(Message.findById(message._id));
        await writeAuditLog(req, {
            action: "message.worker_send",
            resource: "Message",
            resourceId: message._id,
            metadata: { schedule: schedule._id }
        });
        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/admin", protect, adminOnly, async (req, res) => {
    try {
        const messages = await populateMessage(
            Message.find({}).sort({ createdAt: -1 })
        );

        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
