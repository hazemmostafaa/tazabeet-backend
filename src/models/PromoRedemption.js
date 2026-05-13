const mongoose = require("mongoose");

const promoRedemptionSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        schedule: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Schedule",
            default: null
        },
        code: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            index: true
        },
        discountPercent: {
            type: Number,
            required: true
        },
        discountAmount: {
            type: Number,
            default: 0
        },
        currency: {
            type: String,
            default: "EGP"
        }
    },
    { timestamps: true }
);

promoRedemptionSchema.index({ customer: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("PromoRedemption", promoRedemptionSchema);
