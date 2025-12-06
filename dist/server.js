"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = __importDefault(require("./app"));
const offer_1 = __importDefault(require("./routes/offer"));
const highestDiscount_1 = __importDefault(require("./routes/highestDiscount"));
const PORT = 4000;
app_1.default.use("/offer", offer_1.default);
app_1.default.use("/highest-discount", highestDiscount_1.default);
async function start() {
    try {
        await mongoose_1.default.connect("mongodb://127.0.0.1:27017/flipkartOffers");
        console.log("MongoDB connected");
        app_1.default.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    }
    catch (err) {
        console.error(err);
    }
}
start();
//# sourceMappingURL=server.js.map