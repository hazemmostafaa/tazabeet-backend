const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
    {
        schedule: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Schedule",
            required: true
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        worker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        reason: {
            type: String,
            required: true
        },
        details: {
            type: String,
            default: ""
        },
        status: {
            type: String,
            enum: ["open", "reviewing", "resolved"],
            default: "open"
        },
        adminNote: {
            type: String,
            default: ""
        },
        resolvedAt: Date
    },
    { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
