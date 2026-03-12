const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.post("/create", organizationController.createOrganization);
router.post("/join", organizationController.joinOrganization);
router.get("/members", organizationController.getMembers);
router.post("/members/:userId/approve", organizationController.approveMember);
router.post("/members/:userId/reject", organizationController.rejectMember);

module.exports = router;
