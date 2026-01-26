export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message } = req.body;

  try {
    const dbHeaders = {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    };

    // 1. FETCH CURRENT STATE
    const dbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren&select=*`, { headers: dbHeaders });
    const dbData = await dbRes.json();
    if (!dbData || dbData.length === 0) return res.status(200).json({ reply: "[ERROR: PLAYER 'Darren' NOT FOUND IN DB]" });
    
    let state = dbData[0];

    // 2. AI BRAIN
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: `You are the Ironbound DM. Character: Grim Jailor. STATE: ${state.has_bribe_item ? 'TRUSTED' : 'GUARDED'}. If the player searches the straw and they haven't found the ring yet, they find a 'Signet Ring'. If they find it, you MUST include the text 'TRIGGER_BRIBE_FOUND' in your reply.` },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    if (!aiData.choices) return res.status(200).json({ reply: `[AI ERROR: ${JSON.stringify(aiData)}]` });
    
    let reply = aiData.choices[0].message.content;
    let bribeTriggered = false;

    // 3. TRIGGER UPDATE
    if (reply.includes('TRIGGER_BRIBE_FOUND')) {
      bribeTriggered = true;
      reply = reply.replace('TRIGGER_BRIBE_FOUND', '').trim();
      
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren`, {
        method: "PATCH",
        headers: dbHeaders,
        body: JSON.stringify({ has_bribe_item: true })
      });
    }

    res.status(200).json({ reply, has_bribe: state.has_bribe_item || bribeTriggered });

  } catch (err) {
    res.status(200).json({ reply: `[CRITICAL_SYSTEM_FAIL: ${err.message}]` });
  }
}
