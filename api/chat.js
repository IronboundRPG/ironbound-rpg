export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message } = req.body;

  try {
    const dbHeaders = {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    };

    // 1. FETCH WORLD STATE (Does the player have the ring in the database?)
    const dbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren&select=*`, { headers: dbHeaders });
    const dbData = await dbRes.json();
    let state = dbData[0];

    // 2. THE DORN SPECIFICATION (Built from your PDF)
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are Dorn the Jailor. 
            FINGERPRINT: Gravelly, cockney, angry, predatory. 
            TONE: Speak in short, choppy sentences. Use contractions naturally.
            FORBIDDEN: Never say 'Traveler', 'Greetings', or 'Quest'.
            SIGNATURES: "It's more than my job's worth", "only the warden knows such things", "shut up, maggot!".

            WORLD KNOWLEDGE:
            - Player possesses Signet Ring: ${state.has_bribe_item ? 'YES' : 'NO'}.
            
            BEHAVIOR RULES:
            - DEFAULT STATE: GUARDED. View the player as sub-human scum with a sob story. 
            - IF PLAYER HAS RING: You do not 'know' they have it until they mention/show it. Stay GUARDED.
            - IF PLAYER OFFERS RING: Shift to TRUSTED. Become calmer and willing to cooperate for your own promotion.
            - DO NOT be helpful. You only care about your promotion and the ring.

            ACTION: If player searches straw and has no ring, they find 'Signet Ring'. 
            MANDATORY: Add 'TRIGGER_BRIBE_FOUND' if they find it.` 
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0].message.content;
    let bribeTriggered = false;

    // 3. TRIGGER: Update Database if the ring is found
    if (reply.includes('TRIGGER_BRIBE_FOUND')) {
      bribeTriggered = true;
      reply = reply.replace('TRIGGER_BRIBE_FOUND', '').trim();
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren`, {
        method: "PATCH",
        headers: dbHeaders,
        body: JSON.stringify({ has_bribe_item: true })
      });
    }

    res.status(200).json({ 
        reply, 
        has_bribe: state.has_bribe_item || bribeTriggered 
    });

  } catch (err) {
    res.status(200).json({ reply: `[DORN_MALFUNCTION: ${err.message}]` });
  }
}
