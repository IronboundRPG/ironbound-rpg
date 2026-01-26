export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message } = req.body;

  try {
    const dbHeaders = {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    };

    const dbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren&select=*`, { headers: dbHeaders });
    const dbData = await dbRes.json();
    let state = dbData[0] || { minutes_left: 180, has_bribe_item: false, is_cell_locked: true };
    let newTime = Math.max(0, (state.minutes_left || 180) - 1);

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are Dorn the Jailor. Cockney, abusive, predatory. 
            WORLD DATA:
            - Player has Bribe Item: ${state.has_bribe_item ? 'YES' : 'NO'}.
            - Cell Door is: ${state.is_cell_locked ? 'LOCKED' : 'OPEN'}.
            - Execution in: ${newTime}m.

            MANDATORY LOGIC:
            1. If player searches straw AND has_bribe is NO: They find 'Gold'. End with 'TRIGGER_BRIBE_FOUND'.
            2. If player HANDS OVER the gold/bribe: Dorn takes it. He MUST unlock the door now. End with 'TRIGGER_CELL_OPEN'.
            3. If Door is OPEN and player tries to leave: Describe them escaping into the shadows.
            
            VOICE: Abusive but corruptible. Use "maggot". Signature: "It's more than my job's worth".`
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0]?.message?.content || "Dorn grunts...";
    let updates = { minutes_left: newTime };

    if (reply.includes('TRIGGER_BRIBE_FOUND')) {
        updates.has_bribe_item = true;
        reply = reply.replace('TRIGGER_BRIBE_FOUND', '').trim();
    }
    if (reply.includes('TRIGGER_CELL_OPEN')) {
        updates.is_cell_locked = false;
        reply = reply.replace('TRIGGER_CELL_OPEN', '').trim();
    }

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren`, {
      method: "PATCH",
      headers: dbHeaders,
      body: JSON.stringify(updates)
    });

    res.status(200).json({ 
        reply, 
        has_bribe: state.has_bribe_item || updates.has_bribe_item,
        is_locked: updates.is_cell_locked !== undefined ? updates.is_cell_locked : state.is_cell_locked,
        minutes_left: newTime
    });

  } catch (err) { res.status(200).json({ reply: "[DORN_OFFLINE]" }); }
}
