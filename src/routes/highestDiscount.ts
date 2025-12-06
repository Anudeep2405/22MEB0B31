import { Router } from "express";
import { Offer } from "../models/Offer";

const router = Router();

// GET /highest-discount?amountToPay=10000&bankName=HDFC&paymentInstrument=EMI_OPTIONS(optional)
router.get("/", async (req, res) => {
  const amountToPay = Number(req.query.amountToPay);
  const bankName = req.query.bankName as string | undefined;
  const paymentInstrument = req.query.paymentInstrument as string | undefined;

  // Basic validation
  if (!amountToPay || Number.isNaN(amountToPay)) {
    return res.status(400).json({
      error: "amountToPay is required and must be a number"
    });
  }

  if (!bankName) {
    return res.status(400).json({
      error: "bankName is required"
    });
  }

  try {
    // 1) Build Mongo query
    const query: any = { bankName };

    if (paymentInstrument) {
      query.paymentInstrument = paymentInstrument;
    }

    // 2) Fetch all offers for that bank (and instrument, if provided)
    const offers = await Offer.find(query);

    if (offers.length === 0) {
      return res.json({
        highestDiscountAmount: 0,
        bestOffer: null,
        message: "No matching offers found for given bank/paymentInstrument"
      });
    }

    // 3) Find offer with highest 'value'
    // Flipkart 'value' is in paise (e.g. 50000 = ₹500), so we convert at the end
    let bestOffer = offers[0];
    for (const o of offers) {
      if ((o.value ?? 0) > (bestOffer.value ?? 0)) {
        bestOffer = o;
      }
    }

    const bestDiscountPaise = bestOffer.value ?? 0;
    const highestDiscountAmount = bestDiscountPaise / 100; // convert to rupees

    // 4) Respond with amount + meta info about the best offer
    return res.json({
      highestDiscountAmount,
      bestOffer: {
        bankName: bestOffer.bankName,
        offerType: bestOffer.type,
        title: bestOffer.title,
        paymentInstrument: bestOffer.paymentInstrument,
        flipkartOfferId: bestOffer.flipkartOfferId,
        rawValuePaise: bestOffer.value
      }
    });
  } catch (err) {
    console.error("Error in GET /highest-discount:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
