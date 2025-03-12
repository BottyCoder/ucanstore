const express = require("express");
const router = express.Router();
const axios = require("axios");
require("dotenv").config();
const { getValidAccessToken } = require("./auth");
const { supabase } = require("../utils/supabaseClient");
const { logEvent } = require("../utils/logger");

const HUBSPOT_API_URL = "https://api.hubapi.com";

// Create Contact, Create Ticket, and Associate Contact with Ticket
router.post("/create-contact-ticket", async (req, res) => {
  try {
    const { firstname, lastname, email, phone, branch, contactId } = req.body;

    if (!firstname || !lastname || !email) {
      return res.status(400).json({ error: "First name, last name, and email are required." });
    }

    // Log the event for debugging
    logEvent("Create Contact and Ticket", { firstname, lastname, email });

    // Step 1: Get HubSpot Access Token
    const accessToken = await getValidAccessToken();

    // Step 2: Create Contact
    const createContactResponse = await axios.post(
      `${HUBSPOT_API_URL}/crm/v3/objects/contacts`,
      {
        properties: [
          { property: "email", value: email },
          { property: "firstname", value: firstname },
          { property: "lastname", value: lastname },
          { property: "phone", value: phone },
          { property: "branch__forms_", value: branch }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const createdContactId = createContactResponse.data.id;
    logEvent("Contact Created", { contactId: createdContactId });

    // Step 3: Create Ticket
    const createTicketResponse = await axios.post(
      `${HUBSPOT_API_URL}/crm/v3/objects/tickets`,
      {
        properties: [
          { property: "subject", value: "WA Bot - Lead From Bot" },
          { property: "content", value: "Opening ticket directly from WA Bot.. Please answer this as if it was a real lead coming in" },
          { property: "hs_pipeline", value: "0" }, // Example pipeline ID
          { property: "hs_pipeline_stage", value: "1" } // Example stage ID
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const createdTicketId = createTicketResponse.data.id;
    logEvent("Ticket Created", { ticketId: createdTicketId });

    // Step 4: Associate Contact with Ticket
    const associateContactResponse = await axios.put(
      `${HUBSPOT_API_URL}/crm/v3/associations/tickets/${createdTicketId}/contacts/${createdContactId}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    logEvent("Contact Associated with Ticket", { contactId: createdContactId, ticketId: createdTicketId });

    // Step 5: Send Success Response
    res.status(200).json({
      message: "Contact and Ticket created and associated successfully.",
      contactId: createdContactId,
      ticketId: createdTicketId
    });
  } catch (error) {
    console.error(error);
    logEvent("Error in Create Contact and Ticket Process", { error: error.message });
    res.status(500).json({ error: "Failed to create contact and ticket." });
  }
});

module.exports = router;
