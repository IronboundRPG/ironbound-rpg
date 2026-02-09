export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message, playerName } = req.body;

  try {
    const dbHeaders = {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    };

    const userQuery = playerName || "Anonymous_Prisoner";
    const dbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.${userQuery}&select=*`, { headers: dbHeaders });
    const dbData = await dbRes.json();
    let state = dbData[0] || { player_name: userQuery, minutes_left: 180, has_bribe_item: false, is_cell_locked: true };

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ 
          role: "system", 
          content: `You are Dorn the Jailor. 
          WORLD: Bribe=${state.has_bribe_item}, Door=${state.is_cell_locked ? 'LOCKED' : 'OPEN'}.
          LOGIC: 
          1. If they offer the ring AND door is LOCKED, unlock it and end with TRIGGER_CELL_OPEN.
          2. If door is OPEN and they say they are leaving/stepping out, end with TRIGGER_ESCAPE.`
        }, { role: "user", content: message }]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0]?.message?.content || "Dorn snorts.";
    let updates = { minutes_left: Math.max(0, state.minutes_left - 1) };
    let escapeTriggered = false;

    if (reply.includes('TRIGGER_CELL_OPEN')) {
        updates.is_cell_locked = false;
        reply = reply.replace('TRIGGER_CELL_OPEN', '').trim();
    }
    if (reply.includes('TRIGGER_ESCAPE')) {
        escapeTriggered = true;
        reply = "Go on then, get out of my sight before I change my mind...";
    }

    // PERSISTENCE
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.${userQuery}`, {
      method: "PATCH", headers: dbHeaders, body: JSON.stringify(updates)
    });

    // VOICE (REDACTED FOR SPACE - KEEP YOUR EXISTING VOICE CODE HERE)
    // ... [Voice fetch logic] ...

    res.status(200).json({ 
        reply, 
        audio: audioBase64, 
        is_escaped: escapeTriggered, // Tell UI to change scene
        is_locked: updates.is_cell_locked ?? state.is_cell_locked 
    });

  } catch (err) { res.status(200).json({ reply: "[DORN_SILENCED]" }); }
}
