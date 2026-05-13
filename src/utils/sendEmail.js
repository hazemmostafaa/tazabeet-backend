const nodemailer = require("nodemailer");
const https = require("https");

function postJson({ hostname, path, headers, body }) {
    const payload = JSON.stringify(body);

    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname,
                path,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(payload),
                    ...headers,
                },
                timeout: 15000,
            },
            (res) => {
                let data = "";

                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    let parsed = {};

                    try {
                        parsed = data ? JSON.parse(data) : {};
                    } catch (err) {
                        parsed = {};
                    }

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                        return;
                    }

                    const message = parsed.message || parsed.error || data || "Request failed";
                    reject(new Error(`${res.statusCode}: ${message}`));
                });
            }
        );

        req.on("timeout", () => {
            req.destroy(new Error("Connection timeout"));
        });

        req.on("error", reject);
        req.write(payload);
        req.end();
    });
}

async function sendBrevoEmail({ to, subject, text, html }) {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
        return null;
    }

    const fromEmail = process.env.BREVO_FROM_EMAIL || process.env.MAIL_FROM || process.env.SMTP_USER;

    if (!fromEmail) {
        throw new Error("BREVO_FROM_EMAIL or MAIL_FROM is required");
    }

    const recipients = Array.isArray(to) ? to : [to];
    const body = {
        sender: {
            name: process.env.BREVO_FROM_NAME || "TAZABEET",
            email: fromEmail,
        },
        to: recipients.map((email) => ({ email })),
        subject,
    };

    if (html) {
        body.htmlContent = html;
    } else {
        body.textContent = text || "";
    }

    return postJson({
        hostname: "api.brevo.com",
        path: "/v3/smtp/email",
        headers: {
            accept: "application/json",
            "api-key": apiKey,
        },
        body,
    });
}

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
    const brevoResult = await sendBrevoEmail({ to, subject, text, html });
    if (brevoResult) return brevoResult;

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
