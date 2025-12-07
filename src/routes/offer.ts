import { Router } from "express";
import { Offer } from "../models/Offer";

const router = Router();

// Helper: safely get nested properties
function getOfferListFromFlipkartResponse(data: any) {
  if (!data?.items || !Array.isArray(data.items)) return [];

  const offerListItem = data.items.find((i: any) => i.type === "OFFER_LIST");
  return offerListItem?.data?.offers?.offerList ?? [];
}

// Helper: build offerId -> paymentInstrument mapping (prefer structured data)
function getOfferPaymentInstrumentMap(data: any) {
  const map = new Map();
  if (!data?.items || !Array.isArray(data.items)) return map;

  // First, use structured PAYMENT_OPTION instrumentType if available
  for (const item of data.items) {
    if (item.type === "PAYMENT_OPTION" && item.data?.instrumentType) {
      const instrumentType = item.data.instrumentType;
      // Nested offers (EMI_OPTIONS, etc.)
      if (item.data.content?.options && Array.isArray(item.data.content.options)) {
        for (const opt of item.data.content.options) {
          const offers = opt.aggregatedOffer?.callout?.content?.information?.offers ?? [];
          for (const offer of offers) {
            const offerId = offer.offerFooter?.tncInfo?.id;
            if (offerId) {
              map.set(offerId, instrumentType);
            }
          }
        }
      }
    }
  }

  // Next, map offers in OFFER_LIST to their parent PAYMENT_OPTION instrumentType if possible
  const offerListItem = data.items.find((i: any) => i.type === "OFFER_LIST");
  if (offerListItem?.data?.offers?.offerList) {
    const offerList = offerListItem.data.offers.offerList;
    for (const raw of offerList) {
      const offerId = raw?.offerDescription?.id;
      if (!offerId || map.has(offerId)) continue;
      // Try to find a PAYMENT_OPTION with matching provider or metadata
      let matchedInstrument = null;
      for (const item of data.items) {
        if (item.type === "PAYMENT_OPTION" && item.data?.instrumentType) {
          // If providers match, assign instrumentType
          const providers = raw.provider ?? [];
          if (item.data.content?.options) {
            for (const opt of item.data.content.options) {
              const optProviders = opt.provider ?? [];
              if (providers.some((p: string) => optProviders.includes(p))) {
                matchedInstrument = item.data.instrumentType;
                break;
              }
            }
          }
        }
        if (matchedInstrument) break;
      }
      if (matchedInstrument) {
        map.set(offerId, matchedInstrument);
        continue;
      }
      // Fallback: parse description/title if structured mapping fails
      const desc = (raw.offerDescription?.text ?? "").toLowerCase();
      const title = (raw.offerText?.text ?? "").toLowerCase();
      if (desc.includes("no cost emi") || title.includes("no cost emi")) {
        map.set(offerId, "NO_COST_EMI");
        continue;
      }
      if (desc.includes("emi") || title.includes("emi")) {
        map.set(offerId, "EMI_OPTIONS");
        continue;
      }
      if (desc.includes("credit card") || title.includes("credit card")) {
        map.set(offerId, "CREDIT");
        continue;
      }
      if (desc.includes("debit card") || title.includes("debit card")) {
        map.set(offerId, "DEBIT");
        continue;
      }
      if (desc.includes("upi") || title.includes("upi")) {
        map.set(offerId, "UPI");
        continue;
      }
      if (desc.includes("net banking") || title.includes("net banking")) {
        map.set(offerId, "NET_OPTIONS");
        continue;
      }
    }
  }
  return map;
}

// Helper: parse offer details in a single pass
function parseOfferDetails(raw: any, meta: { type: string | null; value: number | null }, paymentInstrument: string | null) {
  const offerDescription = raw?.offerDescription?.text ?? "";
  const title = raw?.offerText?.text ?? "";
  const providers: string[] = raw.provider ?? [];

  // Extract discount percent, max discount, min order, and No Cost EMI flag in one pass
  let percent = null, maxDiscount = null, minOrder = null, isNoCostEmi = false;
  const descLower = offerDescription.toLowerCase();
  const titleLower = title.toLowerCase();

  // Discount percent
  const percentMatch = offerDescription.match(/(\d+)%/);
  if (percentMatch) percent = parseInt(percentMatch[1]);

  // Max discount
  const maxMatch = offerDescription.match(/up to [₹₹]?([\d,]+)/i);
  if (maxMatch) maxDiscount = parseInt(maxMatch[1].replace(/,/g, ""));

  // Min order
  const minOrderMatch = offerDescription.match(/on orders? of [₹₹]?([\d,]+)/i);
  if (minOrderMatch) minOrder = parseInt(minOrderMatch[1].replace(/,/g, ""));

  // No Cost EMI flag
  if (descLower.includes("no cost emi") || titleLower.includes("no cost emi") || paymentInstrument === "NO_COST_EMI") {
    isNoCostEmi = true;
  }

  return {
    offerDescription,
    title,
    providers,
    percent,
    maxDiscount,
    minOrder,
    isNoCostEmi,
    paymentInstrument,
    type: meta.type,
    value: meta.value ?? 0
  };
}

// POST /offer
// Body: { "flipkartOfferApiResponse": { ...full Flipkart PAYMENT_OPTIONS JSON... } }
router.post("/", async (req, res) => {
  const data = req.body.flipkartOfferApiResponse;

  if (!data) {
    return res
      .status(400)
      .json({ error: "flipkartOfferApiResponse is required in request body" });
  }

  try {
    // 1) Build a map: offerId -> { type, value }
    const summary = data?.viewTracking?.offersAvailable?.offerSummary ?? [];
    const summaryById = new Map<string, { type: string | null; value: number | null }>();

    for (const s of summary) {
      summaryById.set(s.id, {
        type: s.type ?? null,
        value: typeof s.value === "number" ? s.value : null
      });
    }

    // 2) Build a map: offerId -> paymentInstrument
    const offerPaymentInstrumentMap = getOfferPaymentInstrumentMap(data);
    // 3) Get the detailed offers list (what user sees in "Offers on online payment")
    const offerList = getOfferListFromFlipkartResponse(data);

    let noOfOffersIdentified = 0;
    let noOfNewOffersCreated = 0;

    for (const raw of offerList) {
      const flipkartOfferId = raw?.offerDescription?.id;

      if (!flipkartOfferId) continue;

      const meta = summaryById.get(flipkartOfferId) ?? { type: null, value: null };
      const paymentInstrument = offerPaymentInstrumentMap.get(flipkartOfferId) ?? null;

      // Parse all offer details in one pass
      const details = parseOfferDetails(raw, meta, paymentInstrument);

      const banks = details.providers.length ? details.providers : [null];

      for (const bankName of banks) {
        noOfOffersIdentified++;

        try {
          // Upsert to avoid duplicates:
          const result = await Offer.updateOne(
            {
              flipkartOfferId,
              bankName,
              paymentInstrument
            },
            {
              $setOnInsert: {
                flipkartOfferId,
                bankName,
                paymentInstrument,
                title: details.title,
                offerDescription: details.offerDescription,
                type: details.type,
                value: details.value,
                percent: details.percent,
                maxDiscount: details.maxDiscount,
                minOrder: details.minOrder,
                isNoCostEmi: details.isNoCostEmi
              }
            },
            { upsert: true }
          );

          // result.upsertedCount === 1 means a new document was inserted
          if ((result as any).upsertedCount === 1) {
            noOfNewOffersCreated++;
          }
        } catch (err) {
          console.error("DB error while upserting offer:", err);
        }
      }
    }

    return res.json({
      message: "Offers processed successfully",
      noOfOffersIdentified,
      noOfNewOffersCreated
    });
  } catch (err) {
    console.error("Error in POST /offer:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
