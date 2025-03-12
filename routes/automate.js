// routes/automate.js
const express = require("express");
const router = express.Router();
const axios = require("axios");

const { supabase } = require("../utils/supabaseClient");
const { getValidAccessToken } = require("../utils/authHelper");
const { logEvent } = require("../utils/logger");

const HUBSPOT_API_URL = "https://api.hubapi.com";

router.post("/", async (req, res) => {
  logEvent("AutomationRoute_Invoked", { bodyReceived: req.body });

  try {
    //
    // 1) Extract relevant fields from request
    //
    let { contactName, ticketId, noteMessage } = req.body;
    logEvent("Step1_Input", { contactName, ticketId, noteMessage });

    // 2) Get valid HubSpot token
    logEvent("Step2_GetAccessToken", {});
    const accessToken = await getValidAccessToken();
    logEvent("Step2_AccessTokenReceived", { snippet: accessToken.slice(0, 8) });

    //
    // 3) If contactName is provided, find that contact in HubSpot, plus their first ticket
    //
    let singleContact = null; // We'll store the contact object (hubspotId, name, etc.)
    if (contactName && !ticketId) {
      logEvent("Step3_SearchContact", { contactName });
      // Build a simple name-based search
      const tokens = contactName.trim().split(/\s+/);
      let searchPayload;
      if (tokens.length === 1) {
        // Single token => firstname= OR lastname=
        const single = tokens[0];
        searchPayload = {
          filterGroups: [
            { filters: [{ propertyName: "firstname", operator: "EQ", value: single }] },
            { filters: [{ propertyName: "lastname", operator: "EQ", value: single }] }
          ],
          properties: ["firstname", "lastname", "email", "phone"],
          limit: 1
        };
      } else {
        // Multiple tokens => assume first + last
        const first = tokens[0];
        const last = tokens[tokens.length - 1];
        searchPayload = {
          filterGroups: [
            {
              filters: [
                { propertyName: "firstname", operator: "EQ", value: first },
                { propertyName: "lastname", operator: "EQ", value: last }
              ]
            }
          ],
          properties: ["firstname", "lastname", "email", "phone"],
          limit: 1
        };
      }
      // Run the search
      const searchResp = await axios.post(
        `${HUBSPOT_API_URL}/crm/v3/objects/contacts/search`,
        searchPayload,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const foundContacts = searchResp.data.results || [];
      if (foundContacts.length === 0) {
        logEvent("NoContactFound", { contactName });
        return res.status(404).json({ error: `No contact found for "${contactName}"` });
      }

      const c = foundContacts[0];
      const hubspotContactId = c.id;
      // Build a single-contact object (this is all we need)
      const fullname = [c.properties.firstname, c.properties.lastname].filter(Boolean).join(" ");
      singleContact = {
        hubspotId: hubspotContactId,
        name: fullname || null,
        email: c.properties.email || null,
        phone: c.properties.phone || null
      };

      // Next: find the contact's first associated ticket
      logEvent("Step3_FindTicketForContact", { hubspotContactId });
      const assocResp = await axios.get(
        `${HUBSPOT_API_URL}/crm/v3/objects/contacts/${hubspotContactId}/associations/tickets`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const contactTickets = (assocResp.data.results || []).map(obj => obj.id);
      if (contactTickets.length === 0) {
        logEvent("NoTicketForContact", { contactName });
        return res
          .status(404)
          .json({ error: `No tickets associated with "${contactName}"` });
      }
      ticketId = contactTickets[0]; // Use the first
      logEvent("Step3_UsingTicket", { ticketId });
    }

    // If we still don't have ticketId, we can't proceed
    if (!ticketId) {
      logEvent("NoTicketId", {});
      return res
        .status(400)
        .json({ error: "Must provide either contactName or a valid ticketId" });
    }

    //
    // 4) If we got a contactName, 'singleContact' is set
    //    If the user provided only ticketId, we won't have a single contact
    //
    logEvent("Step4_ContactReady", { singleContact, ticketId });

    //
    // 5) Create a note in HubSpot
    //    If noteMessage is provided, use it; else fall back to a default
    //
    let defaultBody = `Ticket #${ticketId} (single-contact mode).`;
    if (singleContact) {
      defaultBody += ` Contact: ${singleContact.name || "(none)"} - ${singleContact.email || ""}`;
    }
    const noteBody =
      noteMessage && noteMessage.trim().length > 0 ? noteMessage : defaultBody;

    const notePayload = {
      properties: {
        hs_note_body: noteBody,
        hs_timestamp: new Date().toISOString() // required by your portal
      }
    };

    logEvent("Step5_CreateNote", { noteBody });
    const noteResp = await axios.post(
      `${HUBSPOT_API_URL}/crm/v3/objects/notes`,
      notePayload,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const noteId = noteResp.data.id;
    logEvent("Step5_NoteCreated", { noteId });

    //
    // 6) Associate the note with the ticket
    //
    logEvent("Step6_AssociateNote", { noteId, ticketId });
    await axios.put(
      `${HUBSPOT_API_URL}/crm/v3/objects/notes/${noteId}/associations/tickets/${ticketId}/note_to_ticket`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    logEvent("Step6_NoteAssociated", { noteId, ticketId });

    //
    // 7) Write everything to Supabase
    //    a) If we have a singleContact, upsert it
    //    b) Upsert the ticket->contact row
    //    c) Insert the note in ticket_notes
    //    d) Insert associations
    //
    logEvent("Step7_SupabaseWrites", {});

    // 7A: If we found a single contact, upsert
    if (singleContact) {
      logEvent("Step7_UpsertSingleContact", singleContact);
      const { error: cErr } = await supabase
        .from("contacts")
        .upsert(
          {
            hubspot_id: singleContact.hubspotId,
            name: singleContact.name,
            email: singleContact.email,
            phone: singleContact.phone
          },
          { onConflict: "hubspot_id" }
        );
      if (cErr) {
        logEvent("Step7_ContactUpsertError", { cErr });
      } else {
        logEvent("Step7_ContactUpsertSuccess", { hubspotId: singleContact.hubspotId });
      }
    }

    // 7B: Upsert hubspot_tickets row if we have singleContact
    //     If no singleContact, user just gave us ticketId with no contact
    if (singleContact) {
      const { error: tErr } = await supabase
        .from("hubspot_tickets")
        .upsert(
          {
            contact_id: singleContact.hubspotId,
            ticket_id: ticketId
            // status defaults to 'open'
          },
          { onConflict: "ticket_id, contact_id" }
        );
      if (tErr) {
        logEvent("Step7_TicketUpsertError", { tErr });
      } else {
        logEvent("Step7_TicketUpsertSuccess", {
          hubspotId: singleContact.hubspotId,
          ticketId
        });
      }
    }

    // 7C: Insert the note in ticket_notes
    const { error: noteError } = await supabase.from("ticket_notes").insert({
      ticket_id: ticketId,
      note_id: noteId,
      note_body: noteBody
    });
    if (noteError) {
      logEvent("Step7_NoteInsertError", { noteError });
    } else {
      logEvent("Step7_NoteInsertSuccess", { ticketId, noteId });
    }

    // 7D: Insert associations in ticket_associations
    //     If we have singleContact, do a ticket->contact row
    if (singleContact) {
      const { error: assocContactErr } = await supabase
        .from("ticket_associations")
        .upsert(
          {
            ticket_id: ticketId,
            contact_id: singleContact.hubspotId,
            note_id: null,
            association_type: "ticket_to_contact"
          },
          { onConflict: "ticket_id, contact_id, association_type" }
        );
      if (assocContactErr) {
        logEvent("Step7_AssociationError_contact", { assocContactErr });
      } else {
        logEvent("Step7_AssociationSuccess_contact", {
          contact: singleContact.hubspotId
        });
      }
    }

    // ...and a row for ticket->note
    const { error: assocNoteErr } = await supabase
      .from("ticket_associations")
      .upsert(
        {
          ticket_id: ticketId,
          note_id: noteId,
          association_type: "ticket_to_note"
        },
        { onConflict: "ticket_id, note_id, association_type" }
      );
    if (assocNoteErr) {
      logEvent("Step7_AssociationError_note", { assocNoteErr });
    } else {
      logEvent("Step7_AssociationSuccess_note", { noteId });
    }

    //
    // 8) Done
    //
    logEvent("AutomationComplete", { ticketId, noteId });
    return res.json({
      success: true,
      ticketId,
      noteId,
      contact: singleContact // might be null if user provided only ticketId
    });
  } catch (error) {
    logEvent("ErrorInAutomation", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return res.status(500).json({
      error: "Failed to complete automation",
      details: error.response?.data || error.message
    });
  }
});

module.exports = router;
