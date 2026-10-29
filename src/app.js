require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const orderRoutes = require("./routes/orderRoutes");
const menuRoutes = require("./routes/menuRoutes");
const reportRoutes = require("./routes/reportRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { authenticate } = require("./middleware/auth");
app.use("/api/auth", authRoutes);
app.use("/api/admin", authenticate, adminRoutes);
app.use("/api/orders", authenticate, orderRoutes);
app.use("/api/menu", authenticate, menuRoutes);
app.use("/api/reports/sales", authenticate, reportRoutes);

const db = require("./config/db");
db.getConnection().then(connection => {
  console.log("MySQL connected successfully");
  connection.release();
}).catch(error => console.error("MySQL connection failed:", error.message));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Cafe POS server running on port ${PORT}`));
