const jwt = require("jsonwebtoken");
const User = require("../models/user");
exports.protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("role isSuspended");

        if (!user) {
            return res.status(401).json({ message: "Not authorized, user not found" });
        }

        if (user.isSuspended) {
            return res.status(403).json({ message: "Account is suspended" });
        }

        req.user = {
            id: user._id.toString(),
            role: user.role
        };
        next();
    } catch (err) {
        return res.status(401).json({ message: "Not authorized, token invalid" });
    }
};


exports.adminOnly = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access only" });
    }
    next();
};


exports.workerOnly = (req, res, next) => {
    if (req.user.role !== "worker") {
        return res.status(403).json({ message: "Worker access only" });
    }
    next();
};


exports.customerOnly = (req, res, next) => {
    if (req.user.role !== "customer") {
        return res.status(403).json({ message: "Customer access only" });
    }
    next();
};
