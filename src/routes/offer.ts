import { Router } from "express";
import { Offer } from "../models/Offer";

const router = Router();

// Helper: safely get nested properties
function getOfferListFromFlipkartResponse(data: any) {
  if (!data?.items || !Array.isArray(data.items)) return [];

  const offerListItem = data.items.find((i: any) => i.type === "OFFER_LIST");
  return offerListItem?.data?.offers?.offerList ?? [];
}

// Helper: build offerId -> paymentInstrument mapping
function getOfferPaymentInstrumentMap(data: any) {
  const map = new Map();
  if (!data?.items || !Array.isArray(data.items)) return map;

  // First, map offers nested in PAYMENT_OPTIONs (EMI_OPTIONS, etc.)
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
  // Find OFFER_LIST and PAYMENT_OPTION items
  const offerListItem = data.items.find((i: any) => i.type === "OFFER_LIST");
  if (offerListItem?.data?.offers?.offerList) {
    const offerList = offerListItem.data.offers.offerList;
    for (const item of data.items) {
      if (item.type === "PAYMENT_OPTION" && item.data?.instrumentType) {
        const instrumentType = item.data.instrumentType;
        for (const raw of offerList) {
          const offerId = raw?.offerDescription?.id;
          if (!offerId || map.has(offerId)) continue;

          // Match by provider or description
          const providers = raw.provider ?? [];
          const desc = (raw.offerDescription?.text ?? "").toLowerCase();
          const title = (raw.offerText?.text ?? "").toLowerCase();

          // EMI_OPTIONS: match if description/title contains 'emi'
          if (instrumentType === "EMI_OPTIONS") {
            if (desc.includes("emi") || title.includes("emi")) {
              map.set(offerId, instrumentType);
            }
          }
          // CREDIT: match if not already mapped as EMI_OPTIONS, and description/title contains 'credit card' or provider is a known credit card bank
          else if (instrumentType === "CREDIT") {
            // Only map as CREDIT if not already mapped as EMI_OPTIONS
            if (!map.has(offerId) && (desc.includes("credit card") || title.includes("credit card") || (providers as string[]).some((p: string) => ["SBI","HDFC","ICICI","AXIS","KOTAK","FLIPKARTSBI","FLIPKARTAXISBANK"].includes(p)))) {
              map.set(offerId, instrumentType);
            }
          }
          // UPI: match if description/title contains 'upi'
          else if (instrumentType === "UPI") {
            if (desc.includes("upi") || title.includes("upi")) {
              map.set(offerId, instrumentType);
            }
          }
          // NET_OPTIONS: match if description/title contains 'net banking'
          else if (instrumentType === "NET_OPTIONS") {
            if (desc.includes("net banking") || title.includes("net banking")) {
              map.set(offerId, instrumentType);
            }
          }
        }
      }
    }
  }
  return map;
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
      const title = raw?.offerText?.text;
      const offerDescription = raw?.offerDescription?.text ?? null;

      if (!flipkartOfferId || !title) continue;

      const meta = summaryById.get(flipkartOfferId) ?? { type: null, value: null };
      const paymentInstrument = offerPaymentInstrumentMap.get(flipkartOfferId) ?? null;

      const baseOffer = {
        flipkartOfferId,
        type: meta.type,
        value: meta.value ?? 0,
        title,
        paymentInstrument,
        offerDescription
      };

      const providers: string[] = raw.provider ?? [];
      // If no provider, treat it as a generic offer (bankName = null)
      const banks = providers.length ? providers : [null];

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
                ...baseOffer,
                bankName,
                paymentInstrument
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
