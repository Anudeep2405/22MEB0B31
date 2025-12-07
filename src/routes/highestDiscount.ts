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

  // bankName is now optional

  try {
    // 1) Build query: offers that support this bank (and instrument, if provided)
    const query: any = {};
    if (bankName) {
      query.bankName = bankName;
    }
    if (paymentInstrument) {
      query.paymentInstrument = paymentInstrument;
    }

    const offers = await Offer.find(query);

    if (offers.length === 0) {
      // No matching offers → discount is 0
      return res.json({ highestDiscountAmount: 0, offerDescription: null, bankName: null, title: null, paymentInstrument: null });
    }

    // Find best offer and compute actual discount
    let bestDiscount = 0;
    let bestOffer = null;

    for (const o of offers) {
      const rawValuePaise = o.value ?? 0;
      const discountRupees = rawValuePaise / 100;
      let minOrderValue = 0;
      let maxDiscount = discountRupees;
      let percentDiscount = null;

      // Parse offerDescription for min order value and max discount
      const desc = o.offerDescription ?? "";
      const title = o.title ?? "";
      // Match 'Min Order Value ₹Z' or 'Min. Txn Value: ₹Z'
      const minOrderMatch = desc.match(/Min(?:\.|imum)?(?:\sOrder|\sTxn)?(?:\sValue)?[:]?\s*₹([\d,]+)/i);
      if (minOrderMatch) {
        minOrderValue = parseInt(minOrderMatch[1].replace(/,/g, ""), 10);
      }
      // Match 'Up to ₹X', 'upto ₹X', 'Max. discount ₹X', 'Max discount ₹X'
      const maxDiscountMatch = desc.match(/(?:Up to|upto|Max(?:\.|imum)?(?:\sdiscount)?)[^₹]*₹([\d,]+)/i);
      if (maxDiscountMatch) {
        maxDiscount = parseInt(maxDiscountMatch[1].replace(/,/g, ""), 10);
      }
      // Match percent discount: '10% off', '5% cashback'
      const percentMatch = desc.match(/(\d+)%\s*(?:off|cashback)/i);
      if (percentMatch) {
        percentDiscount = parseInt(percentMatch[1], 10) / 100;
      }

      // Only consider if amountToPay >= minOrderValue
      if (amountToPay < minOrderValue) continue;

      // Special handling for No Cost EMI
      if (desc.toLowerCase().includes("no cost emi") || title.toLowerCase().includes("no cost emi")) {
        // Only apply discount if description mentions a fee/interest waiver
        let actualDiscount = 0;
        const feeMatch = desc.match(/(interest|processing fee|fee waiver)[^₹]*₹([\d,]+)/i);
        if (feeMatch) {
          actualDiscount = parseInt(feeMatch[2].replace(/,/g, ""), 10);
        }
        if (actualDiscount > bestDiscount) {
          bestDiscount = actualDiscount;
          bestOffer = o;
        }
        continue;
      }

      // Calculate actual discount
      let actualDiscount = 0;
      if (percentDiscount !== null) {
        actualDiscount = Math.min(amountToPay * percentDiscount, maxDiscount);
      } else {
        actualDiscount = Math.min(maxDiscount, amountToPay);
      }

      if (actualDiscount > bestDiscount) {
        bestDiscount = actualDiscount;
        bestOffer = o;
      }
    }

    return res.json({
      highestDiscountAmount: bestDiscount,
      offerDescription: bestOffer?.offerDescription ?? null,
      bankName: bestOffer?.bankName ?? null,
      title: bestOffer?.title ?? null,
      paymentInstrument: bestOffer?.paymentInstrument ?? null
    });
  } catch (err) {
    console.error("Error in GET /highest-discount:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
