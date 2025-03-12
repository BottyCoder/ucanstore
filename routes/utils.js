const convertToSAST = (timestamp) => {
  return moment(timestamp).tz("Africa/Johannesburg").format();
};
app.post("/automate-process", async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ error: "Reply text is required." });
    logEvent("AutomateProcessStart", { reply });

    const accessToken = await refreshAccessToken();
    
    const ticketResponse = await axios.post(
      `${HUBSPOT_API_URL}/crm/v3/objects/tickets/search`,
      {
        filterGroups: [{
          filters: [{ propertyName: "hs_pipeline_stage", operator: "EQ", value: "1" }]
        }]
      },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );

    const tickets = ticketResponse.data.results;
    if (!tickets || tickets.length === 0) {
      logEvent("NoOpenTicketsFound", {});
      return res.json({ success: false, message: "No open tickets found." });
    }
    logEvent("OpenTicketsFound", { tickets });

    for (const ticket of tickets) {
      logEvent("ProcessingTicket", { ticketId: ticket.id });
      
      let contactId = ticket.properties.hs_contact_id || null;
      
      if (!contactId) {
        logEvent("FetchingContactForTicket", { ticketId: ticket.id });
        try {
          const associationResponse = await axios.get(
            `${HUBSPOT_API_URL}/crm/v3/associations/tickets/${ticket.id}/contacts`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (associationResponse.data.results.length > 0) {
            contactId = associationResponse.data.results[0].id;
            logEvent("FoundContactForTicket", { ticketId: ticket.id, contactId });
          } else {
            logEvent("NoContactForTicket", { ticketId: ticket.id });
          }
        } catch (error) {
          logEvent("ErrorFetchingContact", {
            ticketId: ticket.id,
            status: error.response?.status,
            message: error.response?.data || error.message
          });
        }
      }
      if (!contactId) {
        logEvent("SkippingTicketNoContact", { ticketId: ticket.id });
        continue;
      }
    }
    res.json({ success: true, ticketsProcessed: tickets.length });
  } catch (error) {
    logEvent("AutomateProcessError", {
      status: error.response?.status,
      message: error.response?.data || error.message,
      headers: error.response?.headers,
      requestBody: error.config?.data
    });
    res.status(500).json({ error: "Automation process failed." });
  }
});
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = router;
