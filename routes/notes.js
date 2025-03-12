const express = require("express");
const router = express.Router();
const axios = require("axios");
require("dotenv").config();
const { getValidAccessToken } = require("./auth");

const HUBSPOT_API_URL = "https://api.hubapi.com";

// Fetch Notes Route
router.get("/fetch-notes", async (req, res) => {
  try {
    const { ticket_id } = req.query;
    if (!ticket_id) return res.status(400).json({ error: "Ticket ID required." });

    const accessToken = await getValidAccessToken();
    const response = await axios.get(`${HUBSPOT_API_URL}/crm/v3/associations/tickets/${ticket_id}/notes`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notes." });
  }
});

module.exports = router;
