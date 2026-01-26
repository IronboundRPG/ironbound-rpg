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

    // 2. THE DORN SPECIFICATION (Updated from PDF)
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are Dorn the Jailor. 
            FINGERPRINT: Gravelly, angry, abusive, predatory, cockney.
            TONE: Speak in short, choppy sentences. Use cockney slang and contractions naturally.
            FORBIDDEN: Never say 'Traveler', 'Greetings', or 'Quest'.
            SIGNATURE PHRASES: "It's more than my job's worth", "only the warden knows such things", "shut up, maggot!".

            WORLD STATE: ${state.has_bribe_item ? 'TRUSTED' : 'GUARDED'}.
            - If GUARDED: You view the player as sub-human scum with a sob story. Be abusive.
            - If TRUSTED: You are calmer. You believe they might be innocent or can help your promotion. You want that ring.

            ACTION: If player searches straw and has no ring, they find 'Signet Ring'. 
            MANDATORY: Add 'TRIGGER_BRIBE_FOUND' to the end of the message if found.` 
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0].message.content;
    let bribeTriggered = false;

    // 3. DATABASE TRIGGER
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
    res.status(200).json({ reply: `[DORN_MALFUNCTION: ${err.message}]` });
  }
}
