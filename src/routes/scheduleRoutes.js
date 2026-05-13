const express = require("express");
const router = express.Router();
const Schedule = require("../models/Schedule");
const { protect, workerOnly, customerOnly } = require("../middleware/authMiddleware");
const User = require("../models/user");
const PromoRedemption = require("../models/PromoRedemption");
const writeAuditLog = require("../utils/auditLogger");
const { getPromoCode, applyPromoToAmount, applyPromoToEstimate } = require("../utils/promoCodes");
const notifyUser = require("../utils/notify");
const { getCustomerJobs } = require("../controllers/scheduleController");
const { completeJob } = require("../controllers/scheduleController");
const { cancelJob } = require("../controllers/scheduleController");
const { getWorkerRatings } = require("../controllers/scheduleController");
const { rateJob } = require("../controllers/scheduleController");
const CASH_DEBT_LIMIT = Number(process.env.CASH_DEBT_LIMIT || 1000);

const PROGRESS_LABELS = {
    requested: "Booking requested",
    accepted: "Worker accepted",
    price_sent: "Final price sent",
    price_accepted: "Customer accepted price",
    on_the_way: "Worker is on the way",
    arrived: "Worker arrived",
    work_started: "Work started",
    completed: "Job completed",
    cancelled: "Booking cancelled",
};

function addTimeline(schedule, key, actorRole, note = "") {
    schedule.progressStatus = key;
    schedule.timeline = schedule.timeline || [];
    schedule.timeline.push({
        key,
        label: PROGRESS_LABELS[key] || key,
        note,
        actorRole,
        createdAt: new Date(),
    });
}

const PRICE_TABLE = {
    Plumbing: { min: 300, max: 900 },
    Electrical: { min: 250, max: 850 },
    Cleaning: { min: 300, max: 1200 },
    Painting: { min: 1000, max: 5000 },
    Carpentry: { min: 500, max: 3000 },
    "AC Repair": { min: 400, max: 1500 },
    "Pest Control": { min: 600, max: 1800 },
    Carpets: { min: 250, max: 1000 },
    Alumetal: { min: 800, max: 4000 },
    Tiling: { min: 1000, max: 6000 },
    "Gypsum Boards": { min: 1200, max: 6500 },
    Appliances: { min: 350, max: 1800 },
    General: { min: 300, max: 1500 },
};

function estimatePrice(service, description = "", media = []) {
    const base = PRICE_TABLE[service] || PRICE_TABLE.General;
    const text = description.toLowerCase();
    const emergencyWords = ["emergency", "urgent", "flood", "fire", "spark", "burn", "smoke", "gas", "كهرب", "حريق", "دخان", "تسريب كبير"];
    const bigWords = ["big", "broken", "replace", "whole", "many", "large", "كبير", "تغيير", "مكسور"];
    const smallWords = ["small", "simple", "minor", "صغير", "بسيط"];

    let multiplier = 1;
    let severity = "medium";

    if (emergencyWords.some((word) => text.includes(word))) {
        multiplier = 1.35;
        severity = "urgent";
    } else if (bigWords.some((word) => text.includes(word))) {
        multiplier = 1.2;
        severity = "large";
    } else if (smallWords.some((word) => text.includes(word))) {
        multiplier = 0.85;
        severity = "small";
    }

    if (media.length > 0 && severity === "medium") {
        severity = "photo review";
    }

    return {
        min: Math.round((base.min * multiplier) / 25) * 25,
        max: Math.round((base.max * multiplier) / 25) * 25,
        currency: "EGP",
        severity,
        note: "This is an estimated range from service type, description, and uploaded media. The worker sends the final price after inspection.",
    };
}

router.put("/rate/:id", protect, customerOnly, rateJob);
router.get("/worker-ratings/:id", getWorkerRatings);
router.put("/complete/:id", protect, workerOnly, completeJob);
router.put("/cancel/:id", protect, workerOnly, cancelJob);
router.get("/customer", protect, customerOnly, getCustomerJobs);

router.get("/promo/:code", protect, customerOnly, async (req, res) => {
    try {
        const promo = getPromoCode(req.params.code);

        if (!promo) {
            return res.status(404).json({ message: "Invalid promo code" });
        }

        const used = await PromoRedemption.exists({
            customer: req.user.id,
            code: promo.code
        });

        if (used) {
            return res.status(409).json({ message: "You already used this promo code" });
        }

        res.json({
            code: promo.code,
            discountPercent: promo.discountPercent,
            label: promo.label,
            maxDiscount: promo.maxDiscount || null,
            currency: "EGP"
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/public-reviews", async (req, res) => {
    try {
        const reviews = await Schedule.find({
            status: "completed",
            rating: { $gt: 0 },
            review: { $exists: true, $ne: "" }
        })
            .populate("customer", "name")
            .populate("worker", "name")
            .select("service rating review customer worker date")
            .sort({ updatedAt: -1 })
            .limit(12)
            .lean();

        res.json(
            reviews.map((item) => ({
                _id: item._id,
                name: item.customer?.name || "Customer",
                workerName: item.worker?.name || "",
                service: item.service,
                text: item.review,
                rating: item.rating,
                date: item.date
            }))
        );
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/add", protect, workerOnly, async (req, res) => {
    try {
        const { date, startTime, endTime, service } = req.body;

        const schedule = await Schedule.create({
            worker: req.user.id,
            service,
            date,
            startTime,
            endTime,
            status: "available"
        });

        res.status(201).json(schedule);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.get("/worker", protect, workerOnly, async (req, res) => {
    try {
        const data = await Schedule.find({ worker: req.user.id })
            .populate("customer", "name email phone")
            .lean();

        const sanitized = data.map((job) => {
            if (!["confirmed", "completed", "cancelled"].includes(job.status)) {
                if (job.customer) {
                    job.customer = {
                        _id: job.customer._id,
                        name: job.customer.name
                    };
                }
                job.address = "";
                job.location = null;
            }

            return job;
        });

        res.json(sanitized);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.get("/pending", protect, workerOnly, async (req, res) => {
    const data = await Schedule.find({
        worker: req.user.id,
        status: "pending"
    }).populate("customer", "name");

    res.json(data);
});


router.put("/accept/:id", protect, workerOnly, async (req, res) => {
    try {
        const s = await Schedule.findById(req.params.id);

        if (!s) return res.status(404).json({ message: "Not found" });

        if (s.worker.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not your job" });
        }

        if (s.status !== "pending") {
            return res.status(400).json({ message: "Only pending jobs can be accepted" });
        }

        const workerProfile = await User.findById(req.user.id).select("cashDebt verificationStatus");

        if (!workerProfile) {
            return res.status(404).json({ message: "Worker not found" });
        }

        if (workerProfile.verificationStatus !== "verified") {
            return res.status(403).json({ message: "You must be verified by admin before accepting jobs" });
        }

        if (s.paymentType === "cash") {
            if ((workerProfile.cashDebt || 0) >= CASH_DEBT_LIMIT) {
                return res.status(403).json({
                    message: "Cash orders are blocked until you pay your outstanding cash balance. You can still accept online payment orders.",
                });
            }
        }

        if (!s.service) {
            s.service = "General";
        }

        s.status = "confirmed";
        addTimeline(s, "accepted", "worker");

        await s.save({ validateBeforeSave: false });
        await writeAuditLog(req, {
            action: "booking.accept",
            resource: "Schedule",
            resourceId: s._id,
            metadata: { paymentType: s.paymentType }
        });
        await notifyUser(s.customer, "Booking accepted", "Your worker accepted the booking.", { type: "booking", link: "/customer-profile" });

        res.json({ message: "Accepted" });

    } catch (err) {
        console.error("ACCEPT ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.put("/final-price/:id", protect, workerOnly, async (req, res) => {
    try {
        const { amount, note = "" } = req.body;
        const price = Number(amount);

        if (!Number.isFinite(price) || price <= 0) {
            return res.status(400).json({ message: "Enter a valid final price" });
        }

        const s = await Schedule.findById(req.params.id);

        if (!s) return res.status(404).json({ message: "Not found" });

        if (s.worker.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not your job" });
        }

        if (s.status !== "confirmed") {
            return res.status(400).json({ message: "Final price can be sent only after accepting the job" });
        }

        const promo = getPromoCode(s.estimatedPrice?.promoCode);
        const discountedPrice = promo ? applyPromoToAmount(price, promo) : price;

        s.finalPrice = {
            originalAmount: promo ? price : undefined,
            amount: discountedPrice,
            currency: "EGP",
            note: typeof note === "string" ? note.trim() : "",
            status: "pending",
            promoCode: promo?.code,
            discountPercent: promo?.discountPercent,
            sentAt: new Date(),
            respondedAt: null,
        };
        addTimeline(s, "price_sent", "worker", `Final price: ${discountedPrice} EGP`);

        await s.save({ validateBeforeSave: false });
        await writeAuditLog(req, {
            action: "booking.final_price_sent",
            resource: "Schedule",
            resourceId: s._id,
            metadata: { amount: discountedPrice, originalAmount: price, promoCode: promo?.code, paymentType: s.paymentType }
        });
        await notifyUser(s.customer, "Final price sent", `Worker sent final price: ${discountedPrice} EGP.`, { type: "price", link: "/customer-profile" });

        res.json({ message: "Final price sent to customer", finalPrice: s.finalPrice });
    } catch (err) {
        console.error("FINAL PRICE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.put("/quote/:id/:decision", protect, customerOnly, async (req, res) => {
    try {
        const { decision } = req.params;

        if (!["accept", "decline"].includes(decision)) {
            return res.status(400).json({ message: "Invalid quote decision" });
        }

        const s = await Schedule.findById(req.params.id);

        if (!s) return res.status(404).json({ message: "Not found" });

        if (!s.customer || s.customer.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not your booking" });
        }

        if (s.finalPrice?.status !== "pending") {
            return res.status(400).json({ message: "No pending final price for this booking" });
        }

        s.finalPrice.status = decision === "accept" ? "accepted" : "declined";
        s.finalPrice.respondedAt = new Date();

        if (decision === "decline") {
            s.status = "cancelled";
            addTimeline(s, "cancelled", "customer", "Customer declined final price");
        } else {
            addTimeline(s, "price_accepted", "customer");
        }

        await s.save({ validateBeforeSave: false });
        await writeAuditLog(req, {
            action: decision === "accept" ? "booking.final_price_accepted" : "booking.final_price_declined",
            resource: "Schedule",
            resourceId: s._id,
            metadata: { amount: s.finalPrice?.amount, status: s.status }
        });
        await notifyUser(s.worker, decision === "accept" ? "Final price accepted" : "Final price declined", decision === "accept" ? "Customer accepted your final price." : "Customer declined the final price.", { type: "price", link: "/worker-dashboard" });

        res.json({
            message: decision === "accept" ? "Final price accepted" : "Final price declined and booking cancelled",
            schedule: s,
        });
    } catch (err) {
        console.error("QUOTE RESPONSE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});


router.put("/reject/:id", protect, workerOnly, async (req, res) => {
    try {
        const s = await Schedule.findById(req.params.id);

        if (!s) {
            return res.status(404).json({ message: "Not found" });
        }


        if (!s.service) {
            s.service = "General";
        }


        if (s.worker.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not your job" });
        }

        s.status = "available";
        s.customer = null;
        s.address = "";
        s.location = null;
        s.description = "";
        s.bookingMedia = [];
        s.estimatedPrice = undefined;
        s.finalPrice = { status: "none", currency: "EGP" };
        addTimeline(s, "cancelled", "worker", "Worker rejected booking");


        await s.save({ validateBeforeSave: false });
        await writeAuditLog(req, {
            action: "booking.reject",
            resource: "Schedule",
            resourceId: s._id,
            metadata: { paymentType: s.paymentType }
        });
        await notifyUser(s.customer, "Booking rejected", "The worker rejected your booking. Please choose another slot.", { type: "booking", link: "/services" });

        res.json({ message: "Rejected successfully" });

    } catch (err) {
        console.error("REJECT ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/:id", protect, workerOnly, async (req, res) => {
    try {
        const schedule = await Schedule.findById(req.params.id);

        if (!schedule) {
            return res.status(404).json({ message: "Schedule not found" });
        }


        if (schedule.worker.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        await schedule.deleteOne();

        res.json({ message: "Deleted successfully" });

    } catch (err) {
        console.log("DELETE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/available", protect, customerOnly, async (req, res) => {
    try {
        const { service } = req.query;

        const query = {
            status: "available",
        };


        if (service) {
            query.service = service;
        }

        const data = await Schedule.find(query)
            .populate("worker", "name rating totalReviews");

        res.json(data);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/workers-by-service", protect, customerOnly, async (req, res) => {
    try {
        const schedules = await Schedule.find({
            status: "completed",
            rating: { $ne: null },
        })
            .populate("worker", "name rating totalReviews")
            .populate("customer", "name")
            .select("service worker customer rating review date");

        const grouped = {};

        schedules.forEach((schedule) => {
            if (!schedule.service || !schedule.worker) return;

            if (!grouped[schedule.service]) {
                grouped[schedule.service] = [];
            }

            const workerId = schedule.worker._id.toString();
            let workerEntry = grouped[schedule.service].find(
                (worker) => worker._id.toString() === workerId
            );

            if (!workerEntry) {
                workerEntry = {
                    _id: schedule.worker._id,
                    name: schedule.worker.name,
                    phone: schedule.worker.phone,
                    rating: schedule.worker.rating || 0,
                    totalReviews: schedule.worker.totalReviews || 0,
                    completedJobs: 0,
                    feedbacks: [],
                };
                grouped[schedule.service].push(workerEntry);
            }

            workerEntry.completedJobs += 1;

            if (schedule.review || schedule.rating) {
                workerEntry.feedbacks.push({
                    _id: schedule._id,
                    rating: schedule.rating || 0,
                    review: schedule.review || "",
                    customerName: schedule.customer?.name || "Customer",
                    date: schedule.date,
                });
            }
        });

        Object.keys(grouped).forEach((service) => {
            grouped[service].forEach((worker) => {
                worker.feedbacks.sort((a, b) => new Date(b.date) - new Date(a.date));
                worker.feedbacks = worker.feedbacks.slice(0, 3);
            });

            grouped[service].sort((a, b) => {
                const ratingDiff = (b.rating || 0) - (a.rating || 0);
                if (ratingDiff !== 0) return ratingDiff;
                return (b.completedJobs || 0) - (a.completedJobs || 0);
            });
        });

        res.json(grouped);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.post("/book/:id", protect, customerOnly, async (req, res) => {
    try {
        const { paymentType, address, location, description = "", bookingMedia = [], promoCode = "" } = req.body;
        const bookingAddress = typeof address === "string" ? address.trim() : "";
        const promo = promoCode ? getPromoCode(promoCode) : null;

        if (promoCode && !promo) {
            return res.status(400).json({ message: "Invalid promo code" });
        }

        if (promo) {
            const used = await PromoRedemption.exists({
                customer: req.user.id,
                code: promo.code
            });

            if (used) {
                return res.status(409).json({ message: "You already used this promo code" });
            }
        }

        if (!bookingAddress) {
            return res.status(400).json({ message: "Address is required" });
        }

        const s = await Schedule.findById(req.params.id).populate("worker");

        if (!s) return res.status(404).json({ message: "Not found" });

        if (s.status !== "available") {
            return res.status(400).json({ message: "Already booked" });
        }


        s.status = "pending";
        addTimeline(s, "requested", "customer");
        s.customer = req.user.id;
        s.paymentType = paymentType || "cash";
        s.address = bookingAddress;
        s.location = location || null;
        s.description = typeof description === "string" ? description.trim() : "";
        s.bookingMedia = Array.isArray(bookingMedia)
            ? bookingMedia.slice(0, 3).filter((file) => file?.url && file?.type)
            : [];
        s.estimatedPrice = applyPromoToEstimate(
            estimatePrice(s.service, s.description, s.bookingMedia),
            promo
        );
        s.finalPrice = { status: "none", currency: "EGP" };

        await s.save({ validateBeforeSave: false });

        if (promo) {
            const originalMin = s.estimatedPrice?.originalMin || s.estimatedPrice?.min || 0;
            const discountAmount = Math.max(0, originalMin - (s.estimatedPrice?.min || 0));

            await PromoRedemption.create({
                customer: req.user.id,
                schedule: s._id,
                code: promo.code,
                discountPercent: promo.discountPercent,
                discountAmount,
                currency: "EGP"
            });
        }

        await writeAuditLog(req, {
            action: "booking.create",
            resource: "Schedule",
            resourceId: s._id,
            metadata: {
                service: s.service,
                paymentType: s.paymentType,
                estimatedPrice: s.estimatedPrice
            }
        });
        await notifyUser(s.worker, "New booking request", `New ${s.service} booking request.`, { type: "booking", link: "/worker-dashboard" });

        res.json({
            message: "Booking sent",
            estimatedPrice: s.estimatedPrice,
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/progress/:id", protect, workerOnly, async (req, res) => {
    try {
        const { progressStatus, note = "" } = req.body;
        const allowed = ["on_the_way", "arrived", "work_started"];

        if (!allowed.includes(progressStatus)) {
            return res.status(400).json({ message: "Invalid progress status" });
        }

        const s = await Schedule.findById(req.params.id);

        if (!s) return res.status(404).json({ message: "Not found" });

        if (s.worker.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not your job" });
        }

        if (s.status !== "confirmed") {
            return res.status(400).json({ message: "Progress can be updated only for confirmed jobs" });
        }

        if (s.finalPrice?.status !== "accepted") {
            return res.status(400).json({ message: "Customer must accept final price before arrival tracking starts" });
        }

        addTimeline(s, progressStatus, "worker", typeof note === "string" ? note.trim() : "");
        await s.save({ validateBeforeSave: false });

        await writeAuditLog(req, {
            action: `booking.progress.${progressStatus}`,
            resource: "Schedule",
            resourceId: s._id,
            metadata: { progressStatus }
        });
        await notifyUser(s.customer, "Worker progress update", PROGRESS_LABELS[progressStatus] || "Progress updated", { type: "progress", link: "/customer-profile" });

        res.json({ message: "Progress updated", schedule: s });
    } catch (err) {
        console.error("PROGRESS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/my", protect, async (req, res) => {
    try {
        let data;

        if (req.user.role === "worker") {
            data = await Schedule.find({ worker: req.user.id })
                .populate("customer", "name phone");
        } else {
            data = await Schedule.find({ customer: req.user.id })
                .populate("worker", "name phone");
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get("/my-jobs", protect, workerOnly, async (req, res) => {
    try {
        const jobs = await Schedule.find({
            worker: req.user.id,
            status: { $in: ["pending", "confirmed"] }
        })
            .populate("customer", "name phone")
            .lean();

        const sanitized = jobs.map((job) => {
            if (job.status !== "confirmed") {
                if (job.customer) {
                    job.customer = {
                        _id: job.customer._id,
                        name: job.customer.name
                    };
                }
                job.address = "";
                job.location = null;
            }

            return job;
        });

        res.json(sanitized);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
module.exports = router;
