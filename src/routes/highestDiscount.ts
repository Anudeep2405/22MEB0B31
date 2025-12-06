import { Router } from "express";
import { Offer } from "../models/Offer";

const router = Router();

/**
 * GET /highest-discount
 * Query params:
 *  - amountToPay: number (required)
 *  - bankName: string (required)
 *  - paymentInstrument: string (optional - for bonus: CREDIT, EMI_OPTIONS, etc.)
 *
 * Response:
 *  {
 *    "highestDiscountAmount": number
 *  }
 */
router.get("/", async (req, res) => {
  const amountToPayRaw = req.query.amountToPay as string | undefined;
  const bankName = req.query.bankName as string | undefined;
  const paymentInstrument = req.query.paymentInstrument as string | undefined; // bonus (optional)

  const amountToPay = amountToPayRaw ? Number(amountToPayRaw) : NaN;

  // Validate required params
  if (!amountToPayRaw || Number.isNaN(amountToPay)) {
    return res
      .status(400)
      .json({ error: "amountToPay is required and must be a number" });
  }

  if (!bankName) {
    return res.status(400).json({ error: "bankName is required" });
  }

  try {
    // 1) Build query: offers that support this bank (and instrument, if provided)
    const query: any = { bankName };

    if (paymentInstrument) {
      query.paymentInstrument = paymentInstrument;
    }

    const offers = await Offer.find(query);

    if (offers.length === 0) {
      // No matching offers → discount is 0
      return res.json({ highestDiscountAmount: 0 });
    }

    // 2) Find best offer and compute discount
    //
    // We stored Flipkart's "value" field in Offer.value.
    // In their JSON it looks like paise (e.g. 50000 => ₹500),
    // but the assignment says it's OK if our calculation doesn't
    // match Flipkart exactly. We'll:
    //   - treat value as paise
    //   - convert to rupees
    //   - cap it by amountToPay (can't discount more than amount)
    let bestDiscount = 0;

    for (const o of offers) {
      const rawValuePaise = o.value ?? 0;
      const discountRupees = rawValuePaise / 100;

      // cap discount by amountToPay
      const effectiveDiscount = Math.min(discountRupees, amountToPay);

      if (effectiveDiscount > bestDiscount) {
        bestDiscount = effectiveDiscount;
      }
    }

    return res.json({
      highestDiscountAmount: bestDiscount
    });
  } catch (err) {
    console.error("Error in GET /highest-discount:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
