const mongoose = require("mongoose");

const portfolioMediaSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: true
        },
        type: {
            type: String,
            default: "image"
        },
        name: {
            type: String,
            default: ""
        }
    },
    { _id: false }
);

const portfolioItemSchema = new mongoose.Schema(
    {
        id: Number,
        title: {
            type: String,
            default: ""
        },
        desc: {
            type: String,
            default: ""
        },
        media: {
            type: [portfolioMediaSchema],
            default: []
        },
        createdAt: Date
    },
    { _id: true }
);

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
        },
        phone: {
            type: String,
            default: ""
        },
        password: {
            type: String,
            required: true,

        },

        resetPasswordToken: String,
        resetPasswordExpire: Date,
        role: {
            type: String,
            enum: ["customer", "worker", "admin"],
            default: "customer",
        },
        cashDebt: {
            type: Number,
            default: 0
        },
        isSuspended: {
            type: Boolean,
            default: false
        },
        rating: {
            type: Number,
            default: 0
        },
        totalReviews: {
            type: Number,
            default: 0
        },
        experience: {
            type: String,
            default: ""
        },
        profilePhoto: {
            type: String,
            default: ""
        },
        portfolio: {
            type: [portfolioItemSchema],
            default: []
        },
        verificationStatus: {
            type: String,
            enum: ["not_submitted", "pending", "verified", "rejected"],
            default: "not_submitted"
        },
        verificationDocs: [
            {
                name: String,
                type: String,
                url: String
            }
        ],
        verificationNote: {
            type: String,
            default: ""
        },
        favoriteWorkers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ]
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
