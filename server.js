const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();
const moment = require("moment-timezone");
const automateRoutes = require("./routes/automate");



// Initialize Express App
const app = express();
app.use(bodyParser.json()); // ✅ Ensure middleware is applied once

// Serve static files from the "public" directory
app.use(express.static("public"));

// ✅ Utility Function: Logging Events
const LOGS_PATH = "./logs.csv";
const logEvent = (event, details) => {
  const timestamp = moment().tz("Africa/Johannesburg").format();
  const logEntry = `${timestamp},${event},${JSON.stringify(details)}\n`;
  fs.appendFileSync(LOGS_PATH, logEntry);
  console.log(`[LOG] ${timestamp} - ${event}:`, details);
};

// ✅ Mount Routes
app.use("/oauth", require("./routes/auth")); // Ensure correct route prefix
app.use("/contacts", require("./routes/contacts"));
app.use("/tickets", require("./routes/tickets"));
app.use("/notes", require("./routes/notes"));
app.use("/associations", require("./routes/associations"));
app.use("/automate", require("./routes/automate"));



// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
