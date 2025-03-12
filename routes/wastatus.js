const express = require('express');
const { supabase } = require('../utils/supabaseClient'); // Import Supabase client
const { logEvent } = require('../utils/logger');  // Import logger

const router = express.Router();  // Initialize the express router

// Endpoint to handle status updates from 360 Dialog
router.post('/status', async (req, res) => {
  // Log the entire incoming request
  logEvent('Received 360 Dialog status update', req.body);

  // Extract the relevant details from the body
  const { wa_id, status, timestamp } = req.body;

  if (!wa_id || !status || !timestamp) {
    logEvent('Error: Missing required fields', { wa_id, status, timestamp });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Log the extracted information
  logEvent('Received status update', { wa_id, status, timestamp });

  try {
    // Update the message status in the Supabase database
    const { data, error } = await supabase
      .from('messages_log')
      .update({ status, timestamp })
      .eq('wa_id', wa_id);

    if (error) {
      logEvent('Error updating message status', { error });
      return res.status(500).json({ error: 'Error updating message status' });
    }

    // Log successful update
    logEvent('Message status updated successfully', { wa_id, status, timestamp });

    // Respond with success
    res.status(200).json({ success: true });
  } catch (error) {
    // Log the error if any
    logEvent('Error processing status update', { error: error.message });
    res.status(500).json({ error: 'Failed to process status update' });
  }
});

module.exports = router;  // Export the route to use in server.js
