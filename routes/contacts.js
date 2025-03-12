const express = require("express");
const router = express.Router();
const axios = require("axios");
require("dotenv").config();
const { getValidAccessToken } = require("./auth");
const { logEvent } = require("../utils/logger");

const HUBSPOT_API_URL = "https://api.hubapi.com";

// Create Contact in HubSpot
router.post("/create-contact", async (req, res) => {
  try {
    const { firstname, lastname, email, phone } = req.body;
    if (!firstname || !lastname || !email) {
      return res.status(400).json({ error: "First name, last name, and email are required." });
    }

    logEvent("Creating contact in HubSpot", { firstname, lastname, email, phone });

    const accessToken = await getValidAccessToken();
    const response = await axios.post(`${HUBSPOT_API_URL}/crm/v3/objects/contacts`, {
      properties: {
        firstname,
        lastname,
        email,
        phone
      }
    }, { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } });

    logEvent("Contact created successfully", { contactId: response.data.id });
    res.json(response.data);  // Return the contact creation response

    // Proceed to create ticket
    await createTicket(response.data.id);
  } catch (error) {
    logEvent("Error creating contact", error);
    res.status(500).json({ error: "Failed to create contact." });
  }
});

// Create Ticket in HubSpot
const createTicket = async (contactId) => {
  try {
    logEvent("Creating ticket for contact", { contactId });

    const accessToken = await getValidAccessToken();
    const response = await axios.post(`${HUBSPOT_API_URL}/crm/v3/objects/tickets`, {
      properties: {
        subject: "WA Bot - Lead From Bot",
        content: "Opening ticket directly from WA Bot.. Please answer this as if it was a real lead coming in",
        hs_pipeline: "0",  // Use correct pipeline ID
        hs_pipeline_stage: "1"  // Stage ID for 'New'
      }
    }, { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } });

    logEvent("Ticket created successfully", { ticketId: response.data.id });

    // Proceed to associate ticket
    await associateTicket(contactId, response.data.id);
  } catch (error) {
    logEvent("Error creating ticket", error);
  }
};

// Associate Contact with Ticket
const associateTicket = async (contactId, ticketId) => {
  try {
    logEvent("Associating ticket with contact", { contactId, ticketId });

    const accessToken = await getValidAccessToken();
    const response = await axios.put(`${HUBSPOT_API_URL}/crm/v3/objects/tickets/${ticketId}/associations/contacts/${contactId}`, {}, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
    });

    logEvent("Ticket successfully associated with contact", { ticketId, contactId });
    // Send success response if everything is done
    return response.data;
  } catch (error) {
    logEvent("Error associating ticket with contact", error);
  }
};

module.exports = router;
