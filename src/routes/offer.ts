import { Router } from "express";
import { Offer } from "../models/Offer";

const router = Router();

// POST /offer
router.post("/", async (req, res) => {
  const data = req.body.flipkartOfferApiResponse;

  if (!data) {
    return res.status(400).json({ error: "flipkartOfferApiResponse is required" });
  }

  try {
    // --- 1. Extract offer summary list ---
    const summary = data?.viewTracking?.offersAvailable?.offerSummary ?? [];
    const summaryById = new Map<string, { type: any; value: any }>(
      summary.map((s: any) => [s.id, { type: s.type, value: s.value }])
    );

    // --- 2. Extract detailed offerList from items ---
    const offerListItem = data.items?.find((i: any) => i.type === "OFFER_LIST");
    const offerList = offerListItem?.data?.offers?.offerList ?? [];

    let noOfOffersIdentified = 0;
    let noOfNewOffersCreated = 0;

    for (const raw of offerList) {
      const id = raw.offerDescription.id;
      const meta = summaryById.get(id);

      // Base offer data
      const baseOffer = {
        flipkartOfferId: id,
        title: raw.offerText.text,
        description: raw.offerDescription.text,
        type: meta?.type ?? null,
        value: meta?.value ?? null,
      };

      const providers: string[] = raw.provider ?? [];

      // If no provider (generic offer), treat as bankName = null
      const banks = providers.length ? providers : [null];

      for (const bankName of banks) {
        noOfOffersIdentified++;

        try {
          const offerData: any = {
            ...baseOffer,
            paymentInstrument: null, // can be enhanced in bonus section
          };
          
          if (bankName !== null) {
            offerData.bankName = bankName;
          }
          
          const created = await Offer.create(offerData);

          if (created) noOfNewOffersCreated++;
        } catch (err: any) {
          // Duplicate key error → skip
          if (err.code === 11000) {
            continue;
          } else {
            console.error("Unexpected DB error:", err);
          }
        }
      }
    }

    return res.json({
      message: "Offers processed",
      noOfOffersIdentified,
      noOfNewOffersCreated,
    });
  } catch (err) {
    console.error("Error in POST /offer:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
