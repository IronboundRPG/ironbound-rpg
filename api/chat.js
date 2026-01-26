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
    let state = dbData[0] || { minutes_left: 180, has_bribe_item: false };
    let newTime = Math.max(0, (state.minutes_left || 180) - 10);

    // 2. THE DORN SPECIFICATION (Refined for Player Agency)
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are Dorn the Jailor. Cockney, abusive, predatory. 
            
            SCENARIO: The player is in a cell. There is a Signet Ring hidden in the straw.
            
            GAME LOGIC:
            1. If the player searches the straw and possesses_ring is NO: Describe THE PLAYER finding the 'Signet Ring'. Dorn watches them find it and reacts with sudden greed/curiosity. End reply with 'TRIGGER_BRIBE_FOUND'.
            2. If player HAS the ring (possesses_ring: YES): Dorn knows they have it. He is calmer but stays 'Dorn'. He wants that ring to buy his way into a promotion.
            
            CONSTRAINTS: 
            - Use contractions. Short, choppy sentences. 
            - Dorn NEVER finds the ring himself. The player finds it.
            - SIGNATURES: "It's more than my job's worth", "Shut up, maggot!".
            
            DATA: Player has ring: ${state.has_bribe_item ? 'YES' : 'NO'}. Time: ${newTime}m.`
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0]?.message?.content || "Dorn just sneers at you.";
    let bribeFound = reply.includes('TRIGGER_BRIBE_FOUND');

    // 3. DATABASE UPDATE
    const updates = { 
        minutes_left: newTime, 
        has_bribe_item: state.has_bribe_item || bribeFound 
    };

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren`, {
      method: "PATCH",
      headers: dbHeaders,
      body: JSON.stringify(updates)
    });

    res.status(200).json({ 
        reply: reply.replace('TRIGGER_BRIBE_FOUND', '').trim(), 
        has_bribe: updates.has_bribe_item,
        minutes_left: newTime
    });

  } catch (err) {
    res.status(200).json({ reply: "[DORN GRUNTS: CONNECTION LOST]" });
  }
}
