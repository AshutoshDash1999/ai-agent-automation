const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { getTelemetry, updateTelemetry } = require("../controllers/telemetry.controller");

router.get("/", auth, getTelemetry);
router.put("/", auth, updateTelemetry);

module.exports = router;
