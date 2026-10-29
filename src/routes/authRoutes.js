const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

router.post("/login", authController.login);
router.get("/session", authenticate, authController.session);
router.post("/logout", authController.logout);

module.exports = router;
