const express = require("express");
const bodyParser = require("body-parser");
const sendwaRoute = require("./routes/sendwa");  // Import the sendwa.js route

// Initialize Express App
const app = express();
app.use(bodyParser.json());  // Middleware for parsing JSON bodies

// Serve static files from the "public" directory
app.use(express.static("public"));

// ✅ Mount Routes
app.use("/oauth", require("./routes/auth"));
app.use("/contacts", require("./routes/contacts"));
app.use("/tickets", require("./routes/tickets"));
app.use("/notes", require("./routes/notes"));
app.use("/associations", require("./routes/associations"));
app.use("/automate", require("./routes/automate"));

// Mount the sendwa.js route correctly (using app.use)
app.use('/sendwa', sendwaRoute);  // This will properly handle requests to /sendwa

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
