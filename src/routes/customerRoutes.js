const express = require("express");
const router = express.Router();
const User = require("../models/user");

const {
    protect,
    customerOnly
} = require("../middleware/authMiddleware");


router.get("/dashboard", protect, customerOnly, (req, res) => {
    res.json({
        message: "Welcome Customer Dashboard",
        userId: req.user.id
    });
});


router.get("/profile", protect, customerOnly, (req, res) => {
    res.json({
        message: "Customer profile data",
        user: req.user
    });
});

router.get("/favorites", protect, customerOnly, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate("favoriteWorkers", "name rating totalReviews profilePhoto experience verificationStatus");

        res.json(user?.favoriteWorkers || []);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/favorites/:workerId", protect, customerOnly, async (req, res) => {
    try {
        const worker = await User.findOne({ _id: req.params.workerId, role: "worker" });
        if (!worker) return res.status(404).json({ message: "Worker not found" });

        const user = await User.findById(req.user.id);
        const exists = user.favoriteWorkers.some((id) => id.toString() === worker._id.toString());

        if (exists) {
            user.favoriteWorkers = user.favoriteWorkers.filter((id) => id.toString() !== worker._id.toString());
        } else {
            user.favoriteWorkers.push(worker._id);
        }

        await user.save();
        res.json({ message: exists ? "Worker removed from favorites" : "Worker added to favorites", favorited: !exists });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
