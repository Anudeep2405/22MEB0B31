import { Router } from "express";
import { Offer } from "../models/Offer";

const router = Router();

// Helper: safely get nested properties
function getOfferListFromFlipkartResponse(data: any) {
  if (!data?.items || !Array.isArray(data.items)) return [];

  const offerListItem = data.items.find((i: any) => i.type === "OFFER_LIST");
  return offerListItem?.data?.offers?.offerList ?? [];
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

    // 2) Get the detailed offers list (what user sees in "Offers on online payment")
    const offerList = getOfferListFromFlipkartResponse(data);

    let noOfOffersIdentified = 0;
    let noOfNewOffersCreated = 0;

    for (const raw of offerList) {
      const flipkartOfferId = raw?.offerDescription?.id;
      const title = raw?.offerText?.text;

      if (!flipkartOfferId || !title) continue;

      const meta = summaryById.get(flipkartOfferId) ?? { type: null, value: null };

      const baseOffer = {
        flipkartOfferId,
        type: meta.type,
        value: meta.value ?? 0,
        title
        // paymentInstrument: null for now (bonus later)
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
              paymentInstrument: null
            },
            {
              $setOnInsert: {
                ...baseOffer,
                bankName,
                paymentInstrument: null
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
