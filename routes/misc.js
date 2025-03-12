const express = require("express");
const router = express.Router();

// Default route (optional)
router.get("/", (req, res) => {
    res.send("Miscellaneous routes endpoint");
});

module.exports = router;

module.exports = router;
