const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const reportsController = require("../controllers/reportsController");

router.use(protect);

router.get("/quizzes", reportsController.listQuizzes);
router.get("/quizzes/:quizId", reportsController.getQuizReport);
router.get("/quizzes/:quizId/csv", reportsController.downloadQuizCsv);

module.exports = router;

