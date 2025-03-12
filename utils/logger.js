const fs = require("fs");
const moment = require("moment-timezone");

const LOGS_PATH = "./logs.csv";

const logEvent = (event, details) => {
  const timestamp = moment().tz("Africa/Johannesburg").format();
  const logEntry = `${timestamp},${event},${JSON.stringify(details)}\n`;

  fs.appendFileSync(LOGS_PATH, logEntry);
  console.log(`[LOG] ${timestamp} - ${event}:`, details);
};

module.exports = { logEvent };  // ✅ Ensure logEvent is exported
