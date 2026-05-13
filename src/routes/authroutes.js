const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { createRateLimiter } = require("../middleware/securityMiddleware");
const { getWorkerProfile, updateWorkerProfile } = require("../controllers/authcontrollers");

router.get("/worker/:id", getWorkerProfile);
router.put("/worker-profile", protect, updateWorkerProfile);
const {
    register,
    login,
    forgotPassword,
    resetPassword
} = require("../controllers/authcontrollers");

const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many authentication attempts. Try again later."
});

const passwordResetLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many password reset attempts. Try again later."
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/reset-password/:token", passwordResetLimiter, resetPassword);

module.exports = router;
