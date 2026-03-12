const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/", usersController.listAllUsers);
router.patch("/:id/active", usersController.setUserActive);
router.patch("/:id/role", usersController.setUserRole);
router.patch("/:id", usersController.updateUserRoleAndTeam);
router.delete("/by-email", usersController.deleteUserByEmail);

module.exports = router;
