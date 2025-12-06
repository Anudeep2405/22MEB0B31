import mongoose from "mongoose";
import app from "./app";
import offerRouter from "./routes/offer";
import discountRouter from "./routes/highestDiscount";

const PORT = 4000;

app.use("/offer", offerRouter);
app.use("/highest-discount", discountRouter);

async function start() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/flipkartOffers");
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error(err);
  }
}

start();
