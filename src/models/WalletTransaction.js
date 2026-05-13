const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
    {
        worker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        schedule: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Schedule",
            default: null,
            index: true
        },
        type: {
            type: String,
            enum: ["cash_collected", "platform_fee", "online_payment", "adjustment", "payout"],
            required: true
        },
        direction: {
            type: String,
            enum: ["credit", "debit"],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        currency: {
            type: String,
            default: "EGP"
        },
        paymentType: {
            type: String,
            enum: ["cash", "instapay", "vodafone_cash", "fawry", "manual"],
            default: "cash"
        },
        description: {
            type: String,
            default: ""
        },
        status: {
            type: String,
            enum: ["posted", "pending", "failed"],
            default: "posted"
        },
        metadata: {
            type: Object,
            default: {}
        }
    },
    { timestamps: true }
);

walletTransactionSchema.index(
    { worker: 1, schedule: 1, type: 1 },
    {
        unique: true,
        partialFilterExpression: { schedule: { $type: "objectId" } }
    }
);

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
