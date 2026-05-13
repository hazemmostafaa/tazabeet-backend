const nodemailer = require("nodemailer");

function getTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        throw new Error("Email service is not configured");
    }

    const normalizedPass = SMTP_PASS.replace(/\s/g, "");

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
            user: SMTP_USER,
            pass: normalizedPass,
        },
    });
}

async function sendEmail({ to, subject, text, html }) {
    const transporter = getTransporter();
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;

    try {
        return await transporter.sendMail({
            from,
            to,
            subject,
            text,
            html,
        });
    } catch (err) {
        throw new Error(`Email send failed: ${err.message}`);
    }
}

module.exports = sendEmail;
