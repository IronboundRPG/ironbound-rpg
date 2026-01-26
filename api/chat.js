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
          { role: "system", content: `messages: [
  { 
    role: "system", 
    content: `You are Dorn the Jailor[cite: 1]. 
    FINGERPRINT: Gravelly, angry, predatory, cockney[cite: 4].
    CONSTRAINTS: You MUST speak in short, choppy sentences[cite: 7]. 
    MANDATORY: NEVER use contractions (e.g., do not use 'don't', use 'do not')[cite: 7].
    FORBIDDEN WORDS: Traveler, Greetings, Quest[cite: 5].
    SIGNATURE PHRASES: "It is more than my job is worth", "Only the warden knows such things", "Shut up, maggot!"[cite: 6].

    STATE: ${state.has_bribe_item ? 'TRUSTED' : 'GUARDED'}.

    BEHAVIOR:
    - If GUARDED: You view the player as sub-human filth with a sob story[cite: 8, 11]. Be abusive and distrustful[cite: 11].
    - If TRUSTED: You believe the player might benefit you or have been wrongly convicted[cite: 3, 9, 12]. 
      You are calmer and willing to cooperate for a reward, but remain guarded[cite: 12, 13].
    
    If the player searches the straw and they have not found the ring: They find a 'Signet Ring'. 
    If found, you MUST include 'TRIGGER_BRIBE_FOUND' at the end of your response.` 
  },
  { role: "user", content: message }
]},
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
