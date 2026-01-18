export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;

  try {
    // 1. DATABASE FETCH
    const dbUrl = `${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren&select=*`;
    const dbResponse = await fetch(dbUrl, {
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const dbData = await dbResponse.json();
    if (!dbData || dbData.length === 0) {
       return res.status(200).json({ reply: "[DIAGNOSTIC: PLAYER_NOT_FOUND_IN_DB]" });
    }

    const state = dbData[0];
    const currentMode = state.has_bribe_item ? "TRUSTED" : "GUARDED";

    // 2. AI BRAIN FETCH
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are the Ironbound DM. Character: A corrupt, grim jailor. Fingerprint: Cold, stoic, no contractions. STATE: ${currentMode}. 
            If STATE is GUARDED: Mock the player. They die at dawn. 
            If STATE is TRUSTED: You see the gold. Tell them you might leave the cell unbolted. 
            NEVER say 'How can I assist you'.` 
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();

    // 3. SUCCESS RESPONSE
    if (aiData.choices && aiData.choices[0]) {
        res.status(200).json({ 
            reply: `[DEBUG: ${currentMode}] \n\n ${aiData.choices[0].message.content}` 
        });
    } else {
        res.status(200).json({ reply: `[DIAGNOSTIC: AI_API_REJECTED_REQUEST] ${JSON.stringify(aiData.error)}` });
    }

  } catch (error) {
    // This will tell us EXACTLY what happened on your screen
    res.status(200).json({ reply: `[DIAGNOSTIC_FAIL: ${error.message}]` });
  }
}
