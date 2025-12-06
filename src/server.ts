import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import app from "./app";
import offerRouter from "./routes/offer";
import discountRouter from "./routes/highestDiscount";

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined in .env");
}

app.use("/offer", offerRouter);
app.use("/highest-discount", discountRouter);

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Error starting server:", err);
  }
}

start();
