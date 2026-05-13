const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Schedule = require("../models/Schedule");
const WalletTransaction = require("../models/WalletTransaction");
const { protect, workerOnly } = require("../middleware/authMiddleware");
const CASH_DEBT_LIMIT = Number(process.env.CASH_DEBT_LIMIT || 1000);
const CASH_ORDER_COMMISSION = Number(process.env.CASH_ORDER_COMMISSION || 50);

router.get("/dashboard", protect, workerOnly, (req, res) => {
    res.json({
        message: "Welcome Worker Dashboard",
        workerId: req.user.id
    });
});


router.get("/debt-dashboard", protect, workerOnly, async (req, res) => {
    try {
        const worker = await User.findById(req.user.id);

        const debtLimit = CASH_DEBT_LIMIT;
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

router.get("/wallet", protect, workerOnly, async (req, res) => {
    try {
        const worker = await User.findById(req.user.id).select("cashDebt");

        if (!worker) {
            return res.status(404).json({ message: "Worker not found" });
        }

        const completedCashJobs = await Schedule.find({
            worker: req.user.id,
            status: "completed",
            paymentType: "cash",
            "finalPrice.status": "accepted",
            "finalPrice.amount": { $gt: 0 }
        })
            .select("service date finalPrice paymentType customer")
            .sort({ updatedAt: -1 });

        await Promise.all(
            completedCashJobs.map((job) =>
                Promise.all([
                    WalletTransaction.updateOne(
                        { worker: req.user.id, schedule: job._id, type: "cash_collected" },
                        {
                            $setOnInsert: {
                                worker: req.user.id,
                                schedule: job._id,
                                type: "cash_collected",
                                direction: "credit",
                                amount: job.finalPrice.amount,
                                currency: job.finalPrice.currency || "EGP",
                                paymentType: "cash",
                                description: `Cash collected for ${job.service || "service"} job`,
                                status: "posted",
                                metadata: { customer: job.customer }
                            }
                        },
                        { upsert: true }
                    ),
                    WalletTransaction.updateOne(
                        { worker: req.user.id, schedule: job._id, type: "platform_fee" },
                        {
                            $setOnInsert: {
                                worker: req.user.id,
                                schedule: job._id,
                                type: "platform_fee",
                                direction: "debit",
                                amount: CASH_ORDER_COMMISSION,
                                currency: job.finalPrice.currency || "EGP",
                                paymentType: "cash",
                                description: "Platform commission for cash order",
                                status: "posted",
                                metadata: { customer: job.customer }
                            }
                        },
                        { upsert: true }
                    )
                ])
            )
        );

        const allTransactions = await WalletTransaction.find({
            worker: req.user.id,
            status: "posted"
        }).select("type direction amount");

        const totals = allTransactions.reduce(
            (acc, tx) => {
                if (tx.type === "cash_collected") acc.cashCollected += tx.amount || 0;
                if (tx.type === "platform_fee") acc.platformFees += tx.amount || 0;
                if (tx.type === "online_payment") acc.onlinePayments += tx.amount || 0;

                if (tx.direction === "credit") acc.balance += tx.amount || 0;
                if (tx.direction === "debit") acc.balance -= tx.amount || 0;
                return acc;
            },
            { cashCollected: 0, platformFees: 0, onlinePayments: 0, balance: 0 }
        );

        const transactions = await WalletTransaction.find({ worker: req.user.id })
            .populate("schedule", "service date finalPrice paymentType")
            .sort({ createdAt: -1 })
            .limit(30)
            .lean();

        const remainingBeforeBlock = Math.max(CASH_DEBT_LIMIT - (worker.cashDebt || 0), 0);

        res.json({
            currency: "EGP",
            cashCollected: totals.cashCollected,
            platformFees: totals.platformFees,
            onlinePayments: totals.onlinePayments,
            balance: totals.balance,
            cashDebt: worker.cashDebt || 0,
            debtLimit: CASH_DEBT_LIMIT,
            remainingBeforeBlock,
            canAcceptCashOrders: (worker.cashDebt || 0) < CASH_DEBT_LIMIT,
            transactions,
            paymentSetup: {
                cash: "active",
                instapay: "manual_setup_required",
                vodafone_cash: "merchant_setup_required",
                fawry: "merchant_setup_required"
            }
        });
    } catch (error) {
        console.error("WALLET ERROR:", error);
        res.status(500).json({ message: error.message });
    }
});

router.get("/schedule", protect, workerOnly, (req, res) => {
    res.json({
        message: "Worker schedule data"
    });
});

module.exports = router;
