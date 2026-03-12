const express = require("express");
const router = express.Router();
const teamController = require("../controllers/teamController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/", teamController.listTeams);
router.get("/members", teamController.getMembers);
router.get("/:teamId/members", teamController.getTeamMembersByTeamId);
router.post("/create", teamController.createTeam);
router.patch("/:id", teamController.updateTeam);
router.delete("/:id", teamController.deleteTeam);
router.post("/join", teamController.joinTeam);
router.post("/members/:userId/approve", teamController.approveMember);
router.post("/members/:userId/reject", teamController.rejectMember);

module.exports = router;
