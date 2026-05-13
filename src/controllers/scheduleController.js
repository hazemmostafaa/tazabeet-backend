const User = require("../models/user");
const Schedule = require("../models/Schedule");
const WalletTransaction = require("../models/WalletTransaction");
const writeAuditLog = require("../utils/auditLogger");
const notifyUser = require("../utils/notify");
const CASH_ORDER_COMMISSION = Number(process.env.CASH_ORDER_COMMISSION || 50);

function addTimeline(schedule, key, actorRole, note = "") {
    schedule.progressStatus = key;
    schedule.timeline = schedule.timeline || [];
    schedule.timeline.push({
        key,
        label: key === "completed" ? "Job completed" : key === "cancelled" ? "Booking cancelled" : key,
        note,
        actorRole,
        createdAt: new Date(),
    });
}

exports.completeJob = async (req, res) => {
    try {
        const job = await Schedule.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.worker.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not your job" });
        }

        if (job.status === "completed") {
            return res.status(400).json({ message: "Job is already completed" });
        }

        if (job.status !== "confirmed") {
            return res.status(400).json({ message: "Only confirmed jobs can be completed" });
        }

        if (!job.finalPrice?.amount) {
            return res.status(400).json({ message: "Send the final price to the customer before completing the job" });
        }

        if (job.finalPrice.status !== "accepted") {
            return res.status(400).json({ message: "Customer must accept the final price before the job can be completed" });
        }

        job.status = "completed";
        addTimeline(job, "completed", "worker");
        await job.save();

        if (job.paymentType === "cash") {
            await WalletTransaction.updateOne(
                { worker: job.worker, schedule: job._id, type: "cash_collected" },
                {
                    $setOnInsert: {
                        worker: job.worker,
                        schedule: job._id,
                        type: "cash_collected",
                        direction: "credit",
                        amount: job.finalPrice.amount,
                        currency: job.finalPrice.currency || "EGP",
                        paymentType: "cash",
                        description: `Cash collected for ${job.service || "service"} job`,
                        status: "posted",
                        metadata: {
                            customer: job.customer,
                            completedAt: new Date()
                        }
                    }
                },
                { upsert: true }
            );

            await WalletTransaction.updateOne(
                { worker: job.worker, schedule: job._id, type: "platform_fee" },
                {
                    $setOnInsert: {
                        worker: job.worker,
                        schedule: job._id,
                        type: "platform_fee",
                        direction: "debit",
                        amount: CASH_ORDER_COMMISSION,
                        currency: job.finalPrice.currency || "EGP",
                        paymentType: "cash",
                        description: "Platform commission for cash order",
                        status: "posted",
                        metadata: {
                            customer: job.customer,
                            completedAt: new Date()
                        }
                    }
                },
                { upsert: true }
            );

            await User.findByIdAndUpdate(job.worker, {
                $inc: { cashDebt: CASH_ORDER_COMMISSION }
            });
        }

        await writeAuditLog(req, {
            action: "booking.complete",
            resource: "Schedule",
            resourceId: job._id,
            metadata: {
                paymentType: job.paymentType,
                finalPrice: job.finalPrice?.amount,
                cashCommission: job.paymentType === "cash" ? CASH_ORDER_COMMISSION : 0
            }
        });
        await notifyUser(job.customer, "Job completed", "Your service was marked completed. You can leave a review now.", { type: "booking", link: "/customer-profile" });

        res.json({
            message: job.paymentType === "cash"
                ? `Job completed. Cash commission added: ${CASH_ORDER_COMMISSION}`
                : "Job completed successfully"
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getAvailableSchedules = async (req, res) => {
    try {
        const schedules = await Schedule.find({ isBooked: false })
            .populate("worker", "name email phone");

        res.status(200).json(schedules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



exports.bookSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findById(req.params.id);

        if (!schedule) {
            return res.status(404).json({ message: "Schedule not found" });
        }

        if (schedule.isBooked) {
            return res.status(400).json({ message: "Schedule already booked" });
        }

        const { location, address, paymentType } = req.body;

        if (!location) {
            return res.status(400).json({ message: "Location is required" });
        }

        schedule.customer = req.user.id;
        schedule.isBooked = true;
        schedule.status = "pending";

        schedule.location = location;
        schedule.address = address;
        schedule.paymentType = paymentType;

        await schedule.save();

        res.status(200).json({
            message: "Schedule booked successfully",
            schedule
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.cancelJob = async (req, res) => {
    try {
        const job = await Schedule.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.worker.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not your job" });
        }

        job.status = "cancelled";
        addTimeline(job, "cancelled", "worker");
        await job.save();
        await writeAuditLog(req, {
            action: "booking.cancel",
            resource: "Schedule",
            resourceId: job._id,
            metadata: { paymentType: job.paymentType }
        });
        await notifyUser(job.customer, "Booking cancelled", "Your booking was cancelled by the worker.", { type: "booking", link: "/customer-profile" });

        res.json({ message: "Job cancelled successfully" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getCustomerJobs = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const jobs = await Schedule.find({ customer: req.user.id })
            .populate("worker", "name phone")
            .select("date startTime status progressStatus timeline address location service customer worker paymentType description bookingMedia estimatedPrice finalPrice rating review");

        res.json(jobs);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getWorkerJobs = async (req, res) => {
    try {
        const jobs = await Schedule.find({ worker: req.user.id })
            .populate("customer", "name phone")
            .select("date startTime status progressStatus timeline address location service customer worker paymentType description bookingMedia estimatedPrice finalPrice");

        res.json(jobs);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getWorkerRatings = async (req, res) => {
    try {
        const workerId = req.params.id;

        const jobs = await Schedule.find({
            worker: workerId,
            status: "completed",
            rating: { $exists: true }
        }).populate("customer", "name phone");


        const avg =
            jobs.length > 0
                ? jobs.reduce((sum, j) => sum + (j.rating || 0), 0) / jobs.length
                : 0;

        res.json({
            ratings: jobs,
            average: avg.toFixed(1),
            count: jobs.length
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};
exports.rateJob = async (req, res) => {
    try {
        const { rating, review } = req.body;

        const schedule = await Schedule.findById(req.params.id);

        if (!schedule) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (schedule.status !== "completed") {
            return res.status(400).json({ message: "Job not completed yet" });
        }


        schedule.rating = Number(rating);
        schedule.review = review;

        await schedule.save();


        const worker = await User.findById(schedule.worker);

        const allRatings = await Schedule.find({
            worker: schedule.worker,
            rating: { $gt: 0 }
        });

        const total = allRatings.length;

        const avg =
            total === 0
                ? 0
                : allRatings.reduce((sum, j) => sum + j.rating, 0) / total;

        worker.rating = Number(avg.toFixed(1));
        worker.totalReviews = total;

        await worker.save();

        res.json({ message: "Rating submitted successfully" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};
