const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { requireRole } = require("../middleware/auth");

router.get("/", requireRole("manager", "admin"), reportController.getSalesReport);

module.exports = router;
