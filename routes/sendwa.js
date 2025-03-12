const express = require('express');
const axios = require('axios');
const { logEvent } = require('../utils/logger'); // Import your logger utility

const router = express.Router();  // Correct router initialization

// Define POST route to handle incoming request for sending WhatsApp messages
router.post('/', (req, res) => { // No need for '/sendwa' here, express automatically uses it when mounting
  const { phoneNumber, message } = req.body;  // Extract phone number and message

  logEvent('Received request', { phoneNumber, message });  // Log incoming request

  if (!phoneNumber || !message) {
    logEvent('Error: Missing required fields', { phoneNumber, message });  // Log error if missing fields
    return res.status(400).send('Phone number and message are required');
  }

  logEvent('Proceeding with API call to WhatsApp', { phoneNumber, message });  // Log proceeding to API call

  axios.post('https://api.botforce.co.za/whatsapp-api/v1.0/customer/105371/bot/4431d1b02b28478a/template', {
    payload: {
      name: "ucanstore_outbound_customer_response",
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: message  // Dynamically use the message provided in the request
            }
          ]
        },
        {
          index: 0,
          parameters: [
            {
              payload: "flow_BA8E475BC92A4A2F963651D388348CCC",  // Flow key
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
      namespace: "96c9e4e2_bffd_4ccd_ab74_49de11c2f417"  // Your namespace
    },
    phoneNumber: phoneNumber  // Dynamic phone number from the request
  }, {
    headers: {
      'Authorization': 'Basic c06f274b-00b5-41f1-99b2-5f9bcf4c3b19-HG8QpsL', // Use actual API key
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    logEvent('Successfully sent message', { response: response.data });  // Log successful API response
    res.status(200).send('Message sent successfully');
  })
  .catch(error => {
    logEvent('Error sending message to WhatsApp API', { error: error.message });  // Log error if API call fails
    res.status(500).send('Error sending message: ' + error.message);
  });
});

module.exports = router;  // Export the route so it can be used in server.js
