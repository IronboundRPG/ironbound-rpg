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
    let state = dbData[0] || { minutes_left: 180, has_bribe_item: false, is_cell_locked: true };
    let newTime = Math.max(0, (state.minutes_left || 180) - 1);

    // 2. THE DORN SPECIFICATION
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
            - Player has Signet Ring: ${state.has_bribe_item ? 'YES' : 'NO'}.
            - Cell Door is: ${state.is_cell_locked ? 'LOCKED' : 'OPEN'}.
            - Time until dawn: ${newTime}m.
            MANDATORY LOGIC:
            1. If player searches straw AND has no ring: They find 'Signet Ring'. Trigger: TRIGGER_BRIBE_FOUND.
            2. If player OFFERS the ring: Dorn takes it and UNLOCKS the door. Trigger: TRIGGER_CELL_OPEN.
            VOICE: Abusive but corruptible. Use contractions. Short sentences. 
            SIGNATURES: "It's more than my job's worth", "Shut up, maggot!".`
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0]?.message?.content || "Dorn grunts...";
    let updates = { minutes_left: newTime };

    // Process Triggers
    if (reply.includes('TRIGGER_BRIBE_FOUND')) {
        updates.has_bribe_item = true;
        reply = reply.replace('TRIGGER_BRIBE_FOUND', '').trim();
    }
    if (reply.includes('TRIGGER_CELL_OPEN')) {
        updates.is_cell_locked = false;
        reply = reply.replace('TRIGGER_CELL_OPEN', '').trim();
    }

    // 3. GENERATE VOICE (ElevenLabs)
    const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/1TE7ou3jyxHsyRehUuMB`, {
      method: "POST",
      headers: { 
        "xi-api-key": process.env.ELEVENLABS_API_KEY, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        text: reply,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    const audioBuffer = await voiceRes.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    // 4. UPDATE DATABASE
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren`, {
      method: "PATCH",
      headers: dbHeaders,
      body: JSON.stringify(updates)
    });

    res.status(200).json({ 
        reply, 
        audio: audioBase64,
        is_locked: updates.is_cell_locked !== undefined ? updates.is_cell_locked : state.is_cell_locked,
        minutes_left: newTime
    });

  } catch (err) {
    res.status(200).json({ reply: `[DORN_OFFLINE: ${err.
