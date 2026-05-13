const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
    worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    date: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["available", "pending", "confirmed", "completed", "cancelled"],
        default: "available"
    },
    progressStatus: {
        type: String,
        enum: ["slot_created", "requested", "accepted", "price_sent", "price_accepted", "on_the_way", "arrived", "work_started", "completed", "cancelled"],
        default: "slot_created"
    },
    timeline: [
        {
            key: String,
            label: String,
            note: String,
            actorRole: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    paymentType: {
        type: String,
        enum: ["cash", "instapay", "vodafone_cash", "fawry"],
        default: "cash"
    },
    service: {
        type: String,
        required: true,
        enum: [
            "Plumbing",
            "Electrical",
            "Cleaning",
            "Painting",
            "Carpentry",
            "AC Repair",
            "Pest Control",
            "Carpets",
            "Alumetal",
            "Tiling",
            "Gypsum Boards",
            "Appliances",
            "General"
        ]
    },
    rating: {
        type: Number,
        default: null
    },
    review: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    bookingMedia: [
        {
            url: String,
            type: String,
            name: String
        }
    ],
    estimatedPrice: {
        min: Number,
        max: Number,
        originalMin: Number,
        originalMax: Number,
        currency: {
            type: String,
            default: "EGP"
        },
        severity: String,
        note: String,
        promoCode: String,
        discountPercent: Number
    },
    finalPrice: {
        originalAmount: Number,
        amount: Number,
        currency: {
            type: String,
            default: "EGP"
        },
        note: String,
        status: {
            type: String,
            enum: ["none", "pending", "accepted", "declined"],
            default: "none"
        },
        promoCode: String,
        discountPercent: Number,
        sentAt: Date,
        respondedAt: Date
    },
    address: {
        type: String
    },
    location: {
        lat: Number,
        lng: Number
    }
}, { timestamps: true });

module.exports = mongoose.model("Schedule", scheduleSchema);
