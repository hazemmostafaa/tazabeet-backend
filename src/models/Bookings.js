const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    worker: {   
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    review: {
        type: String
    },
    service: String,

    date: String,
    time: String,

    status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "completed"], 
        default: "pending"
    }

}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);