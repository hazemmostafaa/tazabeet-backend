const PROMO_CODES = {
    FIX10: { code: "FIX10", discountPercent: 10, label: "10% off" },
    TAZA15: { code: "TAZA15", discountPercent: 15, label: "15% off" },
    WIN20: { code: "WIN20", discountPercent: 20, label: "20% off", maxDiscount: 300 },
};

function normalizePromoCode(code = "") {
    return typeof code === "string" ? code.trim().toUpperCase() : "";
}

function getPromoCode(code) {
    const normalized = normalizePromoCode(code);
    return PROMO_CODES[normalized] || null;
}

function applyPromoToAmount(amount, promo) {
    if (!promo || !Number.isFinite(Number(amount))) return Number(amount) || 0;

    const rawDiscount = Math.round((Number(amount) * promo.discountPercent) / 100);
    const discount = promo.maxDiscount ? Math.min(rawDiscount, promo.maxDiscount) : rawDiscount;
    return Math.max(0, Number(amount) - discount);
}

function applyPromoToEstimate(estimate, promo) {
    if (!promo || !estimate?.min || !estimate?.max) return estimate;

    return {
        ...estimate,
        originalMin: estimate.min,
        originalMax: estimate.max,
        min: applyPromoToAmount(estimate.min, promo),
        max: applyPromoToAmount(estimate.max, promo),
        promoCode: promo.code,
        discountPercent: promo.discountPercent,
    };
}

module.exports = {
    PROMO_CODES,
    getPromoCode,
    normalizePromoCode,
    applyPromoToAmount,
    applyPromoToEstimate,
};
