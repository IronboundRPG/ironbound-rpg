export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message } = req.body;

  try {
    // 1. FETCH CURRENT STATE
    const dbUrl = `${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren&select=*`;
    const dbHeaders = {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };
    
    const dbRes = await fetch(dbUrl, { headers: dbHeaders });
    const dbData = await dbRes.json();
    let state = dbData[0];

    // 2. THE BRAIN (Now with "Trigger" instructions)
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are the Ironbound DM. Fingerprint: GRIM_BUREAUCRAT. 
            STATE: ${state.has_bribe_item ? 'TRUSTED' : 'GUARDED'}.
            
            SCENARIO: The player is searching the cell. There is a hidden 'Signet Ring' in the straw.
            
            RULES:
            - If the player searches the straw and they DON'T have the ring yet, describe them finding it. 
            - MANDATORY: If they find it, you must include the secret string 'TRIGGER_BRIBE_FOUND' at the very end of your response.
            - If they already have it (STATE: TRUSTED), don't find it again.` 
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0].message.content;

    // 3. THE TRIGGER: If the AI says the ring was found, update the DB!
    if (reply.includes('TRIGGER_BRIBE_FOUND')) {
      await fetch(dbUrl, {
        method: "PATCH",
        headers: dbHeaders,
        body: JSON.stringify({ has_bribe_item: true })
      });
      // Clean the trigger word so the player doesn't see the "code"
      reply = reply.replace('TRIGGER_BRIBE_FOUND', '').trim();
    }

    res.status(200).json({ reply, has_bribe: state.has_bribe_item || reply.includes('TRIGGER_BRIBE_FOUND') });

  } catch (error) {
    res.status(200).json({ reply: `[CRITICAL ERROR: ${error.message}]` });
  }
}
