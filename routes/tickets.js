const express = require("express");
const router = express.Router();
const axios = require("axios");
require("dotenv").config();
const { getValidAccessToken } = require("./auth"); // Import from auth

const HUBSPOT_API_URL = "https://api.hubapi.com";

// Fetch Ticket Route
router.get("/fetch-ticket", async (req, res) => {
  try {
    const { contact_id } = req.query;
    if (!contact_id) return res.status(400).json({ error: "Contact ID required." });

    const accessToken = await getValidAccessToken();
    const response = await axios.get(`${HUBSPOT_API_URL}/crm/v3/associations/contacts/${contact_id}/tickets`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ticket." });
  }
});

module.exports = router;
