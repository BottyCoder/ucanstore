const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const HUBSPOT_API_URL = "https://api.hubapi.com";
const TOKEN_PATH = "./tokens.json";

const getTokens = () => {
  if (fs.existsSync(TOKEN_PATH)) {
    return JSON.parse(fs.readFileSync(TOKEN_PATH));
  }
  return {};
};

const refreshAccessToken = async () => {
  let tokens = getTokens();
  if (!tokens.refresh_token) {
    throw new Error("No refresh token available");
  }
  const response = await axios.post(`${HUBSPOT_API_URL}/oauth/v1/token`, null, {
    params: {
      grant_type: "refresh_token",
      client_id: process.env.HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
    },
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return response.data.access_token;
};

const getValidAccessToken = async () => {
  let tokens = getTokens();
  if (!tokens.access_token || (tokens.obtained_at + tokens.expires_in * 1000) < Date.now()) {
    return await refreshAccessToken();
  }
  return tokens.access_token;
};

module.exports = { getValidAccessToken }; // ✅ Ensure it's exported correctly
