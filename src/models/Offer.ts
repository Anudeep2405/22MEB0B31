import { Schema, model, InferSchemaType } from "mongoose";

const offerSchema = new Schema(
  {
    flipkartOfferId: { type: String, required: true },   // FPO...
    bankName: { type: String, default: null },           // SBI / HDFC / FLIPKARTAXISBANK / null
    value: { type: Number, default: 0 },                 // numeric benefit from summary.value
    type: { type: String, default: null },               // INSTANT_DISCOUNT / CASHBACK_ON_CARD / ...
    title: { type: String, required: true },             // "Save 9500"
    paymentInstrument: { type: String, default: null },  // CREDIT / EMI_OPTIONS / NET_OPTIONS / UPI (bonus)
    offerDescription: { type: String, default: null }    // Full offer description text
  },
  { timestamps: false }
);

// One unique doc per (offerId + bank + instrument)
offerSchema.index(
  { flipkartOfferId: 1, bankName: 1, paymentInstrument: 1 },
  { unique: true }
);

export type OfferDocument = InferSchemaType<typeof offerSchema>;

export const Offer = model<OfferDocument>("Offer", offerSchema);
