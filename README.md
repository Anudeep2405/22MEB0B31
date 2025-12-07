# PiePay Backend Assignment

## Project Overview
This project is a backend API for ingesting and processing e-commerce offers, specifically from Flipkart, and calculating the highest discount available to a user based on payment instruments and offer terms. It uses Node.js, Express.js, TypeScript, and MongoDB (via Mongoose).

## Setup Instructions
1. **Clone the repository:**
   ```powershell
   git clone <repo-url>
   cd 22MEB0B31
   ```
2. **Install dependencies:**
   ```powershell
   npm install
   ```
3. **Configure environment:**
   - Create a `.env` file in the project root.
   - Add your MongoDB connection URI to the `.env` file as follows:
     ```env
     MONGODB_URI=mongodb://<your-mongodb-host>:<port>/<your-db-name>
     ```
   - You must provide your own MongoDB URI. The server will not work unless you connect to your own database.
   - Example for local MongoDB:
     ```env
     MONGODB_URI=mongodb://localhost:27017/piepay
     ```
4. **Run the server:**
   ```powershell
   npm run dev
   ```
   The server will start on `http://localhost:3000` by default.

5. **Sample Data for Testing:**
   - If you do not have a Flipkart API response, you can use the sample JSON files provided in the `sample-data` folder (`flipkart_Api_Response.json`, etc.).
   - Example usage:
     - Copy the contents of a sample JSON file and use it as the body for the POST request below.

6. **Example API Requests:**
   - **POST /offer**
     - Use a tool like Postman or cURL:
     ```bash
     curl -X POST http://localhost:3000/offer \
       -H "Content-Type: application/json" \
       -d '{ "flipkartOfferApiResponse": <paste-sample-json-here> }'
     ```
   - **GET /highest-discount**
     - Example query:
     ```bash
     curl "http://localhost:3000/highest-discount?productId=PRODUCT123&bankName=HDFC&paymentInstrument=CREDIT"
     ```
   - Adjust query parameters as needed for your test case.

## API Endpoints and Usage

### 1. Ingest Offers
**POST `/offer`**
- Ingests Flipkart API response and upserts offers into the database.
- **Body:** JSON object matching Flipkart's offer response format.
- **Example:**
  ```json
  {
    "productId": "...",
    "offerList": [ ... ],
    "PAYMENT_OPTION": { ... }
  }
  ```
- **Response:** `{ message: "Offers ingested successfully" }`

### 2. Get Highest Discount
**GET `/highest-discount`**
- Returns the best actual highest discount available with amount,bank name and user payment instrument.
- **Query Parameters:**
  - `amount` (required)
  - `bankName` (optional)
  - `paymentInstrument` (optional)

- **Response:**
  ```json
  {
    "discount": 500,
    "offerDescription": "10% off up to ₹500 on Credit Cards",
    "bank": "HDFC",
    "title": "Credit Card Offer",
    "paymentInstrument": "CREDIT"
  }
  ```

## Assumptions Made
- Payment instrument mapping prefers structured fields from the Flipkart API (such as instrumentType and provider metadata) and uses offer description parsing only as a fallback when structured data is missing or unclear. No Cost EMI offers are treated as a separate instrument to be able to filter easily.
- Actual discount is calculated from offer terms, not just the maximum possible value (e.g., considers min order, percent, max discount).
- No Cost EMI offers do not provide a cash discount unless explicitly stated.
- Offers are uniquely identified by offerId, bank, and instrument.
- The API is designed to work with Flipkart's sample response structure.
- You must connect your own MongoDB instance using the URI in the `.env` file for the API to function.

## Design Choices
- **Framework:** Chose Node.js with Express.js for its simplicity, scalability, and wide adoption for REST APIs. TypeScript was used for type safety and maintainability.
- **Database:** I am more confident with MongoDB and I find it easy to use.MongoDB was selected for its flexibility with semi-structured data and ease of integration with Mongoose. The schema uses a unique index on (offerId, bank, instrument) to prevent duplicate offers and ensure efficient lookups.
- **Parsing Logic:** Payment instrument mapping and discount calculation primarily leverage structured fields from the Flipkart API (such as instrumentType and provider metadata) for accuracy and efficiency. Text parsing of offer descriptions is used only as a fallback when structured data is unavailable, ensuring robust and optimal processing tailored to Flipkart's data format.

## Scaling GET /highest-discount Endpoint
To handle 1,000 requests per second:

- **Database Indexing:** To make this backend setup optimal, we can index the following fields in MongoDB:
    1.flipkartOfferId
    2.bankName
    3.paymentInstrument.

- **Caching:** I would use an in-memory cache like redis for frequently accessed discount results to reduce database load.
- **Horizontal Scaling:** Can use load balancer and deploy multiple instances of the API.
- **Connection Pooling:** Optimize MongoDB connection pooling for concurrent requests. Set appropriate pool size in  MongoDB driver (e.g., Mongoose's maxPoolSize option) based on expected traffic.
- **Async Processing:** i would use asynchronous logic and non-blocking I/O throughout the stack.

## Improvements with More Time
- Add automated tests for all endpoints and business logic.
- Implement robust error handling and input validation.
- Add authentication and authorization for sensitive endpoints.
- Improve offer parsing to handle more edge cases and formats.
- Use batch upserts instead of per-offer upserts to reduce DB round-trips.
- Can use NLP to parse faster when text is unstructured but it is no necessary in this case.

---
For any questions or clarifications, please refer to the code or contact : anudeep249@gmail.com.
