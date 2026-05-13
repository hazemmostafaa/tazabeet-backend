const express = require("express");
const router = express.Router();
const Booking = require("../models/Bookings");
const { completeBooking } = require("../controllers/bookingController");
router.put("/complete/:id", completeBooking);
const { cancelBooking } = require("../controllers/bookingController");
router.put("/cancel/:id", cancelBooking);
const { rateBooking } = require("../controllers/bookingController");

router.put("/rate/:id", rateBooking);
router.post("/", async (req, res) => {
    try {
        const { service, date, time } = req.body;

        const booking = await Booking.create({
            service,
            date,
            time
        });

        res.status(201).json(booking);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;