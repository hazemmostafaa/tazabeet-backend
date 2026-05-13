const Notification = require("../models/Notification");

async function notifyUser(user, title, body = "", options = {}) {
    try {
        if (!user) return;

        await Notification.create({
            user,
            title,
            body,
            type: options.type || "info",
            link: options.link || ""
        });
    } catch (err) {
        console.log("NOTIFICATION ERROR:", err.message);
    }
}

module.exports = notifyUser;
