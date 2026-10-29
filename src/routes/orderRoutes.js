const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");
const { requireRole } = require("../middleware/auth");

router.post("/", requireRole("cashier", "manager", "admin"), orderController.createOrder);
router.get("/", requireRole("manager", "admin"), orderController.getAllOrders);
router.get("/queue", requireRole("barista", "manager", "admin"), orderController.getBaristaQueue);
router.patch("/:id/status", requireRole("barista", "manager", "admin"), orderController.updateOrderStatus);

module.exports = router;
