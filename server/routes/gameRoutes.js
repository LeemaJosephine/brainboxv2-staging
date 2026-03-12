const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const gameController = require("../controllers/gameController");

router.post("/", protect, gameController.createGame);
router.post("/send-report", gameController.sendReport);
router.get("/:code", gameController.getGameInfo);

module.exports = router;
