const express = require("express");
const swaggerUi = require('swagger-ui-express');
const specs = require('./swagger');
const sendwaRoute = require("./routes/sendwa");  // Import the sendwa.js route
const wastatusRoute = require('./routes/wastatus');  // Import the wastatus route



// Initialize Express App
const app = express();
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));  // Middleware for parsing JSON bodies (this is enough, no need for bodyParser)

  // Serve static files from the "public" directory
app.use(express.static("public"));

// ✅ Mount Routes
app.use("/oauth", require("./routes/auth"));
app.use("/contacts", require("./routes/contacts"));
app.use("/tickets", require("./routes/tickets"));
app.use("/notes", require("./routes/notes"));
app.use("/associations", require("./routes/associations"));
app.use("/automate", require("./routes/automate"));
app.use('/wastatus', wastatusRoute);  // This will handle requests to /wastatus/status

// Mount the sendwa.js route correctly (using app.use)
app.use('/sendwa', sendwaRoute);  // This will properly handle requests to /sendwa

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

