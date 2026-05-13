const express = require("express");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/:id/read", protect, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        res.json(notification);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/read-all", protect, async (req, res) => {
    try {
        await Notification.updateMany({ user: req.user.id }, { read: true });
        res.json({ message: "Notifications marked as read" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
