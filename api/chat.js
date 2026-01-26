export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message } = req.body;

  try {
    const dbHeaders = {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    };

    // 1. FETCH WORLD STATE
    const dbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren&select=*`, { headers: dbHeaders });
    const dbData = await dbRes.json();
    let state = dbData[0];
    let newTime = (state.minutes_left || 180) - 10;

    // 2. THE DORN SPECIFICATION (High Priority Actions)
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are Dorn the Jailor. Cockney, abusive, gravelly.
            
            MANDATORY GAME LOGIC:
            1. If player searches straw AND possesses_ring is NO: They MUST find the 'Signet Ring'. End reply with 'TRIGGER_BRIBE_FOUND'.
            2. If player OFFERS the ring AND possesses_ring is YES: Dorn is bribed. End reply with 'TRIGGER_PRIORITIZE_PROMOTION'.
            
            WORLD DATA:
            - Player possesses Signet Ring: ${state.has_bribe_item ? 'YES' : 'NO'}.
            - Time until execution: ${newTime} minutes.
            
            VOICE: Short, choppy sentences. Use contractions. 
            SIGNATURES: "It's more than my job's worth", "Shut up, maggot!".`
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0].message.content;
    let updates = { minutes_left: newTime };

    // 3. PROCESS TRIGGERS & UPDATE DATABASE
    if (reply.includes('TRIGGER_BRIBE_FOUND')) {
      updates.has_bribe_item = true;
      reply = reply.replace('TRIGGER_BRIBE_FOUND', '').trim();
    }
    
    // We update the DB with the new time and any items found
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren`, {
      method: "PATCH",
      headers: dbHeaders,
      body: JSON.stringify(updates)
    });

    res.status(200).json({ 
        reply, 
        has_bribe: state.has_bribe_item || updates.has_bribe_item,
        minutes_left: newTime
    });

  } catch (err) {
    res.status(200).json({ reply: `[SYSTEM_FAIL: ${err.message}]` });
  }
}
