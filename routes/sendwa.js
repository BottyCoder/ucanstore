const express = require("express");
const axios = require("axios");
const router = express.Router();

// Define the API URL and the Authorization Key for WhatsApp API
const WHATSAPP_API_URL = "https://api.botforce.co.za/whatsapp-api/v1.0/customer/105371/bot/4431d1b02b28478a/template";
const AUTHORIZATION_KEY = "Basic c06f274b-00b5-41f1-99b2-5f9bcf4c3b19-HG8QpsL";

// Route for sending WhatsApp messages through Glitch
router.post("/sendwa", async (req, res) => {
  try {
    // Extract necessary data from the incoming webhook request
    const { phoneNumber, message, flowPostback } = req.body;

    if (!phoneNumber || !message || !flowPostback) {
      return res.status(400).json({ error: "Missing required fields: phoneNumber, message, or flowPostback." });
    }

    // Prepare the payload for the WhatsApp API request
    const payload = {
      payload: {
        name: "ucanstore_outbound_customer_response",
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: message
              }
            ]
          },
          {
            index: 0,
            parameters: [
              {
                payload: `flow_${flowPostback}`,
                type: "payload"
              }
            ],
            sub_type: "quick_reply",
            type: "button"
          }
        ],
        language: {
          code: "en_US",
          policy: "deterministic"
        },
        namespace: "96c9e4e2_bffd_4ccd_ab74_49de11c2f417"
      },
      phoneNumber: phoneNumber
    };

    // Send the request to the WhatsApp API
    const response = await axios.post(WHATSAPP_API_URL, payload, {
      headers: {
        "Authorization": AUTHORIZATION_KEY,
        "Content-Type": "application/json"
      }
    });

    // Log the response for debugging
    console.log("[sendwa] WhatsApp message sent successfully:", response.data);

    // Send a success response back to the webhook caller
    res.status(200).json({ success: true, message: "WhatsApp message sent successfully." });
  } catch (error) {
    // Handle any errors and send a failure response
    console.error("[sendwa] Error sending WhatsApp message:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to send WhatsApp message." });
  }
});

module.exports = router;
