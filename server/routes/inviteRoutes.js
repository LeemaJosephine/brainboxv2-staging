const express = require("express");
const router = express.Router();
const inviteController = require("../controllers/inviteController");
const { protect } = require("../middleware/auth");

router.post("/", protect, inviteController.createInvite);
router.post("/bulk", protect, inviteController.createBulkInvite);
router.get("/validate/:token", inviteController.validateInvite);
router.post("/accept", inviteController.acceptInvite);

module.exports = router;
