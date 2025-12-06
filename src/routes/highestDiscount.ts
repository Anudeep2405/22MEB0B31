import { Router } from "express";
import { Offer } from "../models/Offer";

const router = Router();

// GET /highest-discount?amountToPay=10000&bankName=HDFC&paymentInstrument=EMI_OPTIONS (optional)
router.get("/", async (req, res) => {
  const amountToPay = Number(req.query.amountToPay);
  const bankName = req.query.bankName as string | undefined;
  const paymentInstrument = req.query.paymentInstrument as string | undefined;

  if (!amountToPay) {
    return res
      .status(400)
      .json({ error: "amountToPay is required and must be a number" });
  }

  if (!bankName) {
    return res.status(400).json({ error: "bankName is required" });
  }

  try {
    // 1. Build query
    const query: any = { bankName };

    if (paymentInstrument) {
      query.paymentInstrument = paymentInstrument;
    }

    // 2. Fetch all matching offers from DB
    const offers = await Offer.find(query);

    if (offers.length === 0) {
      return res.json({
        highestDiscountAmount: 0,
        bestOffer: null,
        message: "No matching offers found",
      });
    }

    // 3. Find the offer that gives the highest discount
    let bestDiscount = 0;
    let bestOffer: (typeof offers)[number] | null = null;

    for (const off of offers) {
      // For this assignment, we treat `value` as the discount amount / max benefit.
      const discountValue = off.value ?? 0;

      // You could add more complex logic here later if needed
      if (discountValue > bestDiscount) {
        bestDiscount = discountValue;
        bestOffer = off;
      }
    }

    // 4. Build response object with extra info about the best offer
    return res.json({
      highestDiscountAmount: bestDiscount,
      bestOffer: bestOffer
        ? {
            bankName: bestOffer.bankName,          // which bank/card family
            offerType: bestOffer.type,             // INSTANT_DISCOUNT / CASHBACK_ON_CARD / etc.
            title: bestOffer.title,                // short text like "Save ₹500"  
            paymentInstrument: bestOffer.paymentInstrument, // CREDIT / EMI_OPTIONS / NET_OPTIONS / UPI (if you store it)
            flipkartOfferId: bestOffer.flipkartOfferId,
          }
        : null,
    });
  } catch (err) {
    console.error("Error in GET /highest-discount", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
