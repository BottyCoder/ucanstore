const express = require("express");
const router = express.Router();
const axios = require("axios");
require("dotenv").config();
const { getValidAccessToken } = require("./auth");
const { logEvent } = require("../utils/logger");

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

    logEvent("Fetch Notes", { ticket_id, notes: response.data });
    res.json(response.data);
  } catch (error) {
    logEvent("Fetch Notes Error", { ticket_id: req.query.ticket_id, error: error.message });
    res.status(500).json({ error: "Failed to fetch notes." });
  }
});

// Create a Note Route
router.post("/create-note", async (req, res) => {
  try {
    const { ticket_id, note_body } = req.body;
    if (!ticket_id || !note_body) return res.status(400).json({ error: "Ticket ID and note body required." });

    const accessToken = await getValidAccessToken();
    const response = await axios.post(`${HUBSPOT_API_URL}/engagements/v1/engagements`, {
      engagement: {
        type: "NOTE",
        timestamp: Date.now(),
      },
      associations: {
        ticketIds: [ticket_id],
      },
      metadata: {
        body: note_body,
      },
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      }
    });

    logEvent("Create Note", { ticket_id, note_body, response: response.data });
    res.json(response.data);
  } catch (error) {
    logEvent("Create Note Error", { ticket_id: req.body.ticket_id, error: error.message });
    res.status(500).json({ error: "Failed to create note." });
  }
});

module.exports = router;
