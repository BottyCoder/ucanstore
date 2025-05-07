const express = require('express');
const axios = require('axios');
const { logEvent } = require('../utils/logger');
const { supabase } = require('../utils/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

const router = express.Router();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Validation schema
const messageSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  message: Joi.string().required(),
  customerName: Joi.string().allow(''),
  trackingCode: Joi.string().allow('')
});

// API key middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.SENDWA_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// Apply rate limiting and API key validation
router.use(limiter);
router.use(validateApiKey);

// Define POST route with validation
router.post('/', async (req, res) => {
  // Validate request body
  const { error, value } = messageSchema.validate(req.body);
  if (error) {
    logEvent('Validation Error', { error: error.details });
    return res.status(400).json({ error: error.details[0].message });
  }

  const { phoneNumber, message, customerName, trackingCode } = value;  // Extract phone number, message, and other fields

  logEvent('Received request', { phoneNumber, message, customerName, trackingCode });  // Log incoming request

  if (!phoneNumber || !message) {
    // If either phone number or message is missing, log and return error
    logEvent('Error: Missing required fields', { phoneNumber, message });
    return res.status(400).send('Phone number and message are required');
  }

  logEvent('Proceeding with API call to WhatsApp', { phoneNumber, message });  // Log proceeding to API call

  const wa_id = uuidv4();  // Generate unique wa_id
  const session_tracking_code = trackingCode || uuidv4();  // If trackingCode exists, use it, else generate a new one
  const timestampUTC = moment.utc().format();  // Record timestamp in UTC

  // Prepare WhatsApp Payload
  const whatsappPayload = {
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
  };

  let wamid = null;
  try {
    // Call WhatsApp API with correct authorization token
    const whatsappResponse = await axios.post(
      "https://api.botforce.co.za/whatsapp-api/v1.0/customer/105371/bot/4431d1b02b28478a/template",
      whatsappPayload,
      {
        headers: {
          Authorization: "Basic c06f274b-00b5-41f1-99b2-5f9bcf4c3b19-HG8QpsL",  // Correct WhatsApp API token
          "Content-Type": "application/json"
        }
      }
    );

    if (whatsappResponse.data.responseObject?.message_id) {
      wamid = whatsappResponse.data.responseObject.message_id;
    }
  } catch (error) {
    console.error("❌ WhatsApp API Error:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to send WhatsApp message" });
  }

  // Store message data in Supabase, including tracking code
  try {
    const { data, error } = await supabase
      .from('messages_log')
      .upsert([{
        wa_id,
        original_wamid: wamid,
        tracking_code: session_tracking_code,  // Store the session tracking code
        mobile_number: phoneNumber,  // Store the phone number
        customer_name: customerName,
        message,
        status: "sent",
        timestamp: timestampUTC,
        cost: 0  // Assuming cost is initially 0; adjust accordingly
      }], { onConflict: ['wa_id'] });

    if (error) {
      console.error('❌ Error inserting message log into Supabase:', error.message);
      return res.status(500).json({ error: 'Error storing message log' });
    }

    // After the upsert, explicitly retrieve the latest entry for this wa_id
    const { data: retrievedData, error: selectError } = await supabase
      .from('messages_log')
      .select('*')
      .eq('wa_id', wa_id)  // Use the wa_id to fetch the exact record
      .single();  // We expect only one result

    if (selectError) {
      console.error('❌ Error fetching the inserted record from Supabase:', selectError.message);
      return res.status(500).json({ error: 'Error fetching inserted record' });
    }

    // Log and return the retrieved data
    console.log('📩 Message log stored in Supabase:', retrievedData);
    console.log('Success status: Success');
    res.status(200).json({
      success: true,
      tracking_code: session_tracking_code,
      wa_id,
      wamid,
      stored_data: retrievedData
    });
  } catch (error) {
    console.error("❌ Error inserting message log into Supabase:", error.message);
    res.status(500).json({ error: 'Failed to store message log in database' });
  }
});

module.exports = router;