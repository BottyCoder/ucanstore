const express = require("express");
const router = express.Router();
const axios = require("axios");
require("dotenv").config();
const { getValidAccessToken } = require("../utils/authHelper");
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
  let accessToken;
  try {
    logEvent("ContactCreation_Started", { requestBody: req.body });
    
    const { firstname, lastname, email, phone, branch_forms } = req.body;
    if (!firstname || !lastname || !email || !phone) {
      logEvent("ContactCreation_ValidationFailed", { missingFields: Object.entries({ firstname, lastname, email, phone }).filter(([_, v]) => !v).map(([k]) => k) });
      return res.status(400).json({ error: "Missing required fields." });
    }

    logEvent("ContactCreation_GettingToken", {});
    accessToken = await getValidAccessToken();
    logEvent("ContactCreation_TokenReceived", { tokenSuccess: !!accessToken, tokenSnippet: accessToken ? accessToken.slice(0, 8) : null });
    
    if (!accessToken) {
      logEvent("ContactCreation_TokenFailed", {});
      return res.status(500).json({ error: "Service authentication failed" });
    }

    // If we have valid token, create contact
    const requestBody = {
      properties: {
        firstname,
        lastname,
        email,
        phone,
        branch__forms_: branch_forms
      }
    };
    
    logEvent("ContactCreation_SendingRequest", { requestBody });
    
    const response = await axios.post(`${HUBSPOT_API_URL}/crm/v3/objects/contacts`, requestBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    const contactId = response.data.id;
    logEvent("ContactCreation_Success", { contactId, responseData: response.data });
    
    const successResponse = { 
      success: true,
      message: "Contact created successfully.", 
      contactId 
    };
    
    logEvent("ContactCreation_ResponseSent", { 
      type: "NEW_CONTACT",
      response: successResponse,
      email: req.body.email 
    });
    res.json(successResponse);

  } catch (error) {
    if (error.response?.status === 409) {
      // Contact already exists - get the existing contact ID
      const existingContact = await axios.post(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/search`, {
        filterGroups: [{
          filters: [
            { propertyName: "email", operator: "EQ", value: req.body.email }
          ]
        }]
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      });
      
      if (existingContact.data.results.length > 0) {
        const existingResponse = {
          success: true,
          message: "Contact already exists",
          contactId: existingContact.data.results[0].id
        };
        logEvent("ContactCreation_ExistingContact", { 
          type: "EXISTING_CONTACT",
          response: existingResponse,
          email: req.body.email 
        });
        return res.json(existingResponse);
      }
    }
    
    console.error("Contact Creation Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || "Failed to create contact.",
      code: error.response?.status || 500
    });
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
