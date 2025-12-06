"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Offer = void 0;
const mongoose_1 = require("mongoose");
const OfferSchema = new mongoose_1.Schema({
    flipkartOfferId: { type: String, required: true },
    bankName: { type: String, default: null },
    type: { type: String },
    value: { type: Number },
    title: { type: String, required: true },
    description: { type: String, required: true },
    paymentInstrument: { type: String, default: null },
}, { timestamps: true });
// Avoid duplicates (unique offer per bank + instrument)
OfferSchema.index({ flipkartOfferId: 1, bankName: 1, paymentInstrument: 1 }, { unique: true });
exports.Offer = (0, mongoose_1.model)("Offer", OfferSchema);
//# sourceMappingURL=Offer.js.map