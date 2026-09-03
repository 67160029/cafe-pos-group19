require("dotenv").config();

const express = require("express");
const app = express();

app.use(express.json());

const orderRoutes = require("./routes/orderRoutes");
app.use("/api/orders", orderRoutes);

const db = require("./config/db");

db.getConnection()
  .then((connection) => {
    console.log("MySQL connected successfully");
    connection.release();
  })
  .catch((error) => {
    console.error("MySQL connection failed:", error.message);
  });

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Cafe POS server running on port ${PORT}`);
});
