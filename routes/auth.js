const express = require("express");
const router = express.Router();
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || "https://ucanaiaws.botforce.co.za/oauth/callback";
const HUBSPOT_API_URL = "https://api.hubapi.com";

// ✅ OAuth Start Route
router.get("/start", (req, res) => {
  const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=crm.objects.contacts.write%20oauth%20crm.objects.contacts.read&response_type=code`;

  console.log("[OAuth] Redirecting to:", authUrl);
  res.redirect(authUrl);
});

// ✅ OAuth Callback Route
router.get("/callback", async (req, res) => {
  const authCode = req.query.code;
  const error = req.query.error;

  if (error) {
    console.error('[OAuth] Error:', error);
    return res.status(400).send(`Authorization failed: ${error}`);
  }

  if (!authCode) {
    console.error('[OAuth] No auth code found');
    return res.status(400).send("Authorization code not found.");
  }

  try {
    console.log('[OAuth] Exchanging code for token with redirect URI:', REDIRECT_URI);
    const response = await axios.post("https://api.hubapi.com/oauth/v1/token", null, {
      params: {
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code: authCode,
      },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    console.log("[OAuth] Tokens received:", response.data);
    res.json({ success: true, tokens: response.data });
  } catch (error) {
    console.error("[OAuth] Error during token exchange:", error.response?.data || error.message);
    res.status(500).send("Error obtaining access token.");
  }
});

module.exports = router;