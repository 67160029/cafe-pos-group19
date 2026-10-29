const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminController");
const { requireRole } = require("../middleware/auth");

router.use(requireRole("admin"));
router.get("/staff", controller.listStaff);
router.post("/staff", controller.createStaff);
router.patch("/staff/:id", controller.updateStaff);
router.delete("/staff/:id", controller.deleteStaff);
router.get("/branches", controller.listBranches);
router.post("/branches", controller.createBranch);
router.patch("/branches/:id", controller.updateBranch);

module.exports = router;
