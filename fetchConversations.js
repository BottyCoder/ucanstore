require("dotenv").config();
const axios = require("axios");
const fs = require("fs");

const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const INBOX_ID = "73632431"; // Replace with your actual inbox ID
const LIMIT = 100; // Max results per call
const START_DATE = 1740019200000; // Feb 20, 2025 (in milliseconds)
const END_DATE = 1740191999000; // Feb 22, 2025 (in milliseconds)
const OUTPUT_FILE = "filtered_conversations.json"; // File to save filtered results

async function fetchAndFilterConversations(after = null, allConversations = []) {
  try {
    let url = `https://api.hubapi.com/conversations/v3/conversations/threads?inboxId=${INBOX_ID}&limit=${LIMIT}`;
    if (after) url += `&after=${after}`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}` },
    });

    const conversations = response.data.results;

    // ✅ Step 1: Apply filtering manually (since API filtering is broken)
    const filteredConversations = conversations.filter(conv => {
      const timestamp = new Date(conv.latestMessageTimestamp).getTime();
      return timestamp >= START_DATE && timestamp <= END_DATE;
    });

    allConversations.push(...filteredConversations);

    console.log(
      `Fetched ${conversations.length} total, ${filteredConversations.length} matched filter. Total: ${allConversations.length}`
    );

    // ✅ Step 2: Check for pagination
    const nextPage = response.data.paging?.next?.after;
    if (!nextPage) {
      console.log("✅ No more valid pages. Stopping pagination.");
      return allConversations;
    }

    return fetchAndFilterConversations(nextPage, allConversations);

  } catch (error) {
    if (error.response?.data?.subCategory === "ConversationsApiError.UNPARSEABLE_TOKEN") {
      console.log("✅ No more valid pages. Stopping pagination.");
      return allConversations;
    }

    console.error("❌ Error fetching conversations:", error.response?.data || error.message);
    return allConversations;
  }
}

(async () => {
  console.log("Fetching conversations and manually filtering for Feb 20-22, 2025...");
  const recentConversations = await fetchAndFilterConversations();

  console.log(`✅ Final count of retrieved conversations: ${recentConversations.length}`);

  if (recentConversations.length > 0) {
    console.log("Example conversation:", recentConversations[0]);

    // ✅ Save results to a JSON file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(recentConversations, null, 2));
    console.log(`📁 Saved filtered conversations to ${OUTPUT_FILE}`);
  }
})();
