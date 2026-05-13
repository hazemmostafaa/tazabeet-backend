const Booking = require("../models/Bookings");
exports.completeBooking = async (req, res) => {
    const { id } = req.params;

    const booking = await Booking.findById(id);

    if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
    }

    booking.status = "completed";

    await booking.save();

    res.json({ message: "Job marked as completed" });
};
exports.cancelBooking = async (req, res) => {
    const { id } = req.params;

    const booking = await Booking.findById(id);

    if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
    }

    booking.status = "cancelled";

    await booking.save();

    res.json({ message: "Booking cancelled successfully" });
};
exports.rateBooking = async (req, res) => {
    const { id } = req.params;
    const { rating, review } = req.body;

    try {
        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        if (booking.status !== "completed") {
            return res.status(400).json({ message: "Can only rate completed jobs" });
        }

        booking.rating = rating;
        booking.review = review;

        await booking.save();

        res.json({ message: "Rating submitted successfully ⭐" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};
exports.rateJob = async (req, res) => {
    const { rating, review } = req.body;

    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
        return res.status(404).json({ message: "Job not found" });
    }


    schedule.rating = rating;
    schedule.review = review;
    await schedule.save();


    const worker = await User.findById(schedule.worker);

    const allRatings = await Schedule.find({
        worker: schedule.worker,
        rating: { $exists: true, $ne: null }
    });

    const total = allRatings.length;

    const avg =
        total === 0
            ? 0
            : allRatings.reduce((sum, j) => sum + j.rating, 0) / total;

    worker.rating = Number(avg.toFixed(1));
    worker.totalReviews = total;

    await worker.save();

    res.json({ message: "Rating saved" });
};