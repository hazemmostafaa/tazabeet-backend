const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { securityHeaders, sanitizeRequest } = require("./middleware/securityMiddleware");
require("dotenv").config();

const app = express();

app.use(securityHeaders);
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
}));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(sanitizeRequest);

app.get("/", (req, res) => {
    res.send("TAZABEET Backend is running ");
});


app.use("/api/auth", require("./routes/authroutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/customer", require("./routes/customerRoutes"));
app.use("/api/worker", require("./routes/workerRoutes"));
app.use("/api/schedule", require("./routes/scheduleRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/complaints", require("./routes/complaintRoutes"));
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
app.use("/api/bookings", require("./routes/bookingsroutes"));
