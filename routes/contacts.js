const express = require("express");
const router = express.Router();
const axios = require("axios");
require("dotenv").config();
const { getValidAccessToken } = require("./auth");
const { supabase } = require("../utils/supabaseClient");
const { logEvent } = require("../utils/logger");

const HUBSPOT_API_URL = "https://api.hubapi.com";

// Lookup Contact
router.post("/lookup-contact", async (req, res) => {
  try {
    const { firstname, lastname } = req.body;
    if (!firstname || !lastname) return res.status(400).json({ error: "First and last name required." });

    const accessToken = await getValidAccessToken();
    const response = await axios.post(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/search`, {
      filterGroups: [
        {
          filters: [
            { propertyName: "firstname", operator: "EQ", value: firstname },
            { propertyName: "lastname", operator: "EQ", value: lastname }
          ]
        }
      ]
    }, { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } });

    res.json(response.data);
  } catch (error) {
    logEvent("Contact Lookup Failed", { error: error.message });
    res.status(500).json({ error: "Failed to lookup contact." });
  }
});

// Create Contact
router.post("/create-contact", async (req, res) => {
  try {
    const { firstname, lastname, email, phone, branch_forms } = req.body;
    if (!firstname || !lastname || !email || !phone) return res.status(400).json({ error: "Missing required fields." });

    const accessToken = await getValidAccessToken();
    const response = await axios.post(`${HUBSPOT_API_URL}/crm/v3/objects/contacts`, {
      properties: [
        { property: "firstname", value: firstname },
        { property: "lastname", value: lastname },
        { property: "email", value: email },
        { property: "phone", value: phone },
        { property: "branch__forms_", value: branch_forms }  // Add branch_forms
      ]
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    const contactId = response.data.id; // Get the newly created contact ID
    logEvent("Contact Created", { contactId, firstname, lastname });

    res.json({ message: "Contact created successfully.", contactId });
  } catch (error) {
    logEvent("Contact Creation Failed", { error: error.message });
    res.status(500).json({ error: "Failed to create contact." });
  }
});

// Create Ticket and Associate with Contact

// Create Contact with Auth Check
router.post("/create-contact-with-auth", async (req, res) => {
  try {
    const { firstname, lastname, email, phone, branch_forms } = req.body;
    if (!firstname || !lastname || !email || !phone) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return res.status(500).json({ error: "Service authentication failed" });
    }

    // If we have valid token, create contact
    const response = await axios.post(`${HUBSPOT_API_URL}/crm/v3/objects/contacts`, {
      properties: {
        firstname,
        lastname,
        email,
        phone,
        branch__forms_: branch_forms
      }
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    const contactId = response.data.id;
    res.json({ 
      success: true,
      message: "Contact created successfully.", 
      contactId 
    });

  } catch (error) {
    console.error("Contact Creation Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to create contact." });
  }
});

router.post("/create-ticket", async (req, res) => {
  try {
    const { subject, content, contactId } = req.body;
    if (!subject || !content || !contactId) return res.status(400).json({ error: "Missing required fields." });

    const accessToken = await getValidAccessToken();
    const ticketResponse = await axios.post(`${HUBSPOT_API_URL}/crm/v3/objects/tickets`, {
      properties: [
        { property: "subject", value: subject },
        { property: "content", value: content },
        { property: "hs_pipeline", value: "default" },
        { property: "hs_pipeline_stage", value: "1" }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    const ticketId = ticketResponse.data.id; // Get the newly created ticket ID
    logEvent("Ticket Created", { ticketId, subject, content });

    // Now associate the ticket with the contact
    const associationResponse = await axios.put(`${HUBSPOT_API_URL}/crm/v3/associations/tickets/contacts/batch/create`, {
      inputs: [
        {
          from: { id: ticketId },
          to: { id: contactId },
          type: "ticket_to_contact"
        }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    logEvent("Ticket and Contact Association", { ticketId, contactId });

    res.json({ message: "Ticket created and associated with contact successfully.", ticketId, contactId });
  } catch (error) {
    logEvent("Ticket Creation or Association Failed", { error: error.message });
    res.status(500).json({ error: "Failed to create or associate ticket." });
  }
});

module.exports = router;
