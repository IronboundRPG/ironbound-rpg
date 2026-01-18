export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;

  try {
    // 1. DIRECT DATABASE HOOK (No libraries needed)
    const dbResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren&select=*`, {
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const dbData = await dbResponse.json();
    
    // Check if we actually found the row
    if (!dbData || dbData.length === 0) {
       return res.status(200).json({ reply: "[ SYSTEM ERROR: PLAYER 'Darren' NOT FOUND IN DATABASE ]" });
    }

    const state = dbData[0];
    const currentMode = state.has_bribe_item ? "TRUSTED" : "GUARDED";

    // 2. TALK TO THE AI
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: `You are the Ironbound DM. State: ${currentMode}. Be brief and cold.` },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    res.status(200).json({ reply: `[DEBUG_STATE: ${currentMode}] \n\n ${aiData.choices[0].message.content}` });

  } catch (error) {
    res.status(200).json({ reply: `[ CRITICAL ERROR: ${error.message} ]` });
  }
}
