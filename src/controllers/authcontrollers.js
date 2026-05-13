const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Schedule = require("../models/Schedule");
const sendEmail = require("../utils/sendEmail");

function sendBackgroundEmail(options) {
    sendEmail(options).catch((err) => {
        console.log("EMAIL ERROR:", err.message);
    });
}

function isStrongPassword(password = "") {
    return (
        typeof password === "string" &&
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /\d/.test(password)
    );
}

function normalizeEmail(email = "") {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function normalizePortfolio(portfolio = []) {
    if (!Array.isArray(portfolio)) return [];

    return portfolio.slice(0, 20).map((item) => {
        const media = Array.isArray(item?.media) ? item.media : [];

        return {
            id: Number(item?.id) || Date.now(),
            title: typeof item?.title === "string" ? item.title.trim().slice(0, 120) : "",
            desc: typeof item?.desc === "string" ? item.desc.trim().slice(0, 800) : "",
            media: media.slice(0, 6).map((file) => {
                if (typeof file === "string") {
                    return {
                        url: file,
                        type: file.startsWith("data:video") ? "video" : "image",
                        name: "portfolio media"
                    };
                }

                return {
                    url: typeof file?.url === "string" ? file.url : "",
                    type: typeof file?.type === "string" ? file.type : "image",
                    name: typeof file?.name === "string" ? file.name : ""
                };
            }).filter((file) => file.url),
            createdAt: item?.createdAt ? new Date(item.createdAt) : new Date()
        };
    }).filter((item) => item.title || item.media.length);
}

exports.getWorkerProfile = async (req, res) => {
    try {
        const worker = await User.findById(req.params.id).select("name role rating totalReviews experience profilePhoto portfolio verificationStatus");

        if (!worker) {
            return res.status(404).json({ message: "Worker not found" });
        }

        if (worker.role !== "worker") {
            return res.status(404).json({ message: "Worker not found" });
        }

        const reviews = await Schedule.find({
            worker: worker._id,
            status: "completed",
            rating: { $gt: 0 }
        })
            .populate("customer", "name")
            .select("rating review customer date service createdAt")
            .sort({ createdAt: -1 });

        res.json({
            worker,
            reviews
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.updateWorkerProfile = async (req, res) => {
    try {
        if (req.user.role !== "worker") {
            return res.status(403).json({ message: "Worker access only" });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const { experience, profilePhoto, portfolio, verificationDocs } = req.body;

        user.experience = typeof experience === "string" ? experience : "";
        user.profilePhoto = typeof profilePhoto === "string" ? profilePhoto : "";
        user.set("portfolio", normalizePortfolio(portfolio));
        user.markModified("portfolio");

        if (Array.isArray(verificationDocs)) {
            user.verificationDocs = verificationDocs.slice(0, 4).filter((doc) => doc?.url).map((doc) => ({
                name: typeof doc.name === "string" ? doc.name : "",
                type: typeof doc.type === "string" ? doc.type : "",
                url: typeof doc.url === "string" ? doc.url : ""
            }));
            user.verificationStatus = user.verificationDocs.length ? "pending" : user.verificationStatus;
        }

        await user.save({ validateBeforeSave: true });

        res.json({
            message: "Worker profile updated",
            worker: {
                experience: user.experience,
                profilePhoto: user.profilePhoto,
                portfolio: user.portfolio,
                verificationDocs: user.verificationDocs,
                verificationStatus: user.verificationStatus,
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.register = async (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;
        const userPhone = typeof phone === "string" ? phone.trim() : "";
        const userEmail = normalizeEmail(email);
        const allowedRoles = ["customer", "worker"];

        if (!allowedRoles.includes(role || "customer")) {
            return res.status(400).json({ message: "Invalid account role" });
        }

        if (!userPhone) {
            return res.status(400).json({ message: "Phone number is required" });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters and include uppercase, lowercase, and a number"
            });
        }

        const userExists = await User.findOne({ email: userEmail });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email: userEmail,
            password: hashedPassword,
            role: role || "customer",
            phone: userPhone,
        });

        sendBackgroundEmail({
            to: user.email,
            subject: "Welcome to TAZABEET",
            text: `Hi ${user.name}, your TAZABEET account has been created successfully.`,
            html: `<p>Hi ${user.name},</p><p>Your TAZABEET account has been created successfully.</p>`,
        });

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const userEmail = normalizeEmail(email);


        const user = await User.findOne({ email: userEmail });
        if (!user)
            return res.status(400).json({ message: "Invalid credentials" });

        if (user.isSuspended) {
            return res.status(403).json({ message: "Account is suspended" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(400).json({ message: "Invalid credentials" });


        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "2h" }
        );

        sendBackgroundEmail({
            to: user.email,
            subject: "TAZABEET login notification",
            text: `Hi ${user.name}, your TAZABEET account was just logged in.`,
            html: `<p>Hi ${user.name},</p><p>Your TAZABEET account was just logged in.</p>`,
        });

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                email: user.email,
                phone: user.phone || ""
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const userEmail = normalizeEmail(email);

        const user = await User.findOne({ email: userEmail });

        if (!user) {
            return res.json({ message: "If this email exists, a reset link will be sent" });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;

        await user.save();

        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

        await sendEmail({
            to: user.email,
            subject: "Reset your TAZABEET password",
            text: `Hi ${user.name}, reset your password here: ${resetUrl}`,
            html: `<p>Hi ${user.name},</p><p>Reset your password here:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
        });

        res.json({ message: "Reset link sent to your email" });
    } catch (err) {
        console.log("FORGOT PASSWORD EMAIL ERROR:", err.message);
        res.status(500).json({ message: err.message || "Failed to send reset email" });
    }
};
exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!isStrongPassword(password)) {
        return res.status(400).json({
            message: "Password must be at least 8 characters and include uppercase, lowercase, and a number"
        });
    }

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
        return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.json({ message: "Password reset successful" });
};
module.exports = {
    register: exports.register,
    login: exports.login,
    forgotPassword: exports.forgotPassword,
    resetPassword: exports.resetPassword,
    getWorkerProfile: exports.getWorkerProfile,
    updateWorkerProfile: exports.updateWorkerProfile
};
