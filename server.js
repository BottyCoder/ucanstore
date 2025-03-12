// server.js
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const moment = require("moment-timezone");
const sendwaRoute = require('./routes/sendwa');  // Import sendwa.js route
require("dotenv").config();

const app = express();
app.use(express.json());  // Express's built-in JSON body parsing middleware

// Mount Routes
app.use('/sendwa', sendwaRoute);  // Ensure this is properly mounted

// ✅ Utility Function: Logging Events
const LOGS_PATH = "./logs.csv";
const logEvent = (event, details) => {
  const timestamp = moment().tz("Africa/Johannesburg").format();
  const logEntry = `${timestamp},${event},${JSON.stringify(details)}\n`;
  fs.appendFileSync(LOGS_PATH, logEntry);
  console.log(`[LOG] ${timestamp} - ${event}:`, details);
};

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  logEvent('Server started', { port: PORT });
});
