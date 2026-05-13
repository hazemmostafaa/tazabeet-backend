const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { protect, workerOnly } = require("../middleware/authMiddleware");

router.get("/dashboard", protect, workerOnly, (req, res) => {
    res.json({
        message: "Welcome Worker Dashboard",
        workerId: req.user.id
    });
});


router.get("/debt-dashboard", protect, workerOnly, async (req, res) => {
    try {
        const worker = await User.findById(req.user.id);

        const debtLimit = 1000;
        const remainingLimit = debtLimit - worker.cashDebt;

        res.status(200).json({
            workerId: worker._id,
            currentDebt: worker.cashDebt,
            debtLimit: debtLimit,
            remainingBeforeBlock: remainingLimit > 0 ? remainingLimit : 0,
            canAcceptCashOrders: worker.cashDebt < debtLimit
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
router.get("/schedule", protect, workerOnly, (req, res) => {
    res.json({
        message: "Worker schedule data"
    });
});

module.exports = router;