const express = require("express");
const { protect, customerOnly } = require("../middleware/authMiddleware");

const router = express.Router();

const SERVICES = [
    "Plumbing",
    "Electrical",
    "Cleaning",
    "Painting",
    "Carpentry",
    "AC Repair",
    "Pest Control",
    "Carpets",
    "Alumetal",
    "Tiling",
    "Gypsum Boards",
    "Appliances",
    "General",
];

function stripDataUrl(value = "") {
    const commaIndex = value.indexOf(",");
    return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function parseAiJson(content) {
    try {
        return JSON.parse(content);
    } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) return { reply: content };

        try {
            return JSON.parse(match[0]);
        } catch {
            return { reply: content };
        }
    }
}

router.post("/diagnose", protect, customerOnly, async (req, res) => {
    try {
        const { message = "", file = null } = req.body;
        const cleanMessage = message.trim();

        if (!cleanMessage && !file) {
            return res.status(400).json({ message: "Describe the issue or upload a photo/video." });
        }

        const images = [];

        if (file?.type === "image" && file.dataUrl) {
            images.push(stripDataUrl(file.dataUrl));
        }

        if (file?.type === "video" && Array.isArray(file.frames)) {
            file.frames.slice(0, 4).forEach((frame) => {
                if (frame) images.push(stripDataUrl(frame));
            });
        }

        const prompt = `
You are Tazabeet's home-service safety assistant.
The customer may write in English or Arabic. Reply in the same language the customer mostly used.

Analyze the customer's text and any attached image/video frames.
Give quick, safe steps only until a professional worker arrives.
Do not give dangerous repair instructions such as opening electrical panels, handling live wires, gas work, climbing unsafe areas, bypassing safety devices, or dismantling appliances.
If there is danger, tell the customer to stop, move away, shut off the safe main switch/valve only if accessible, and call emergency services.

Return JSON only in this exact shape:
{
  "reply": "Short helpful answer with safe steps, warnings, and next action.",
  "service": "One of: ${SERVICES.join(", ")}",
  "urgency": "low | medium | high | emergency"
}

Customer message:
${cleanMessage || "(Customer uploaded a file without extra text.)"}
${file?.type === "video" ? "The uploaded video was converted into still frames for analysis." : ""}
`;

        const ollamaResponse = await fetch(process.env.OLLAMA_URL || "http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: process.env.OLLAMA_MODEL || "gemma3",
                stream: false,
                messages: [
                    {
                        role: "user",
                        content: prompt,
                        ...(images.length ? { images } : {}),
                    },
                ],
                options: {
                    temperature: 0.2,
                },
            }),
        });

        if (!ollamaResponse.ok) {
            return res.status(503).json({
                message: "Local AI is not running. Open Ollama and make sure the gemma3 model is installed.",
            });
        }

        const data = await ollamaResponse.json();
        const content = data?.message?.content || "";
        const parsed = parseAiJson(content);
        const service = SERVICES.includes(parsed.service) ? parsed.service : null;

        return res.json({
            reply: parsed.reply || content || "I could not analyze that clearly. Please describe the problem again.",
            service,
            urgency: parsed.urgency || "medium",
        });
    } catch (err) {
        console.error("AI DIAGNOSE ERROR:", err.message);
        return res.status(500).json({ message: "AI diagnosis failed. Please try again." });
    }
});

module.exports = router;
