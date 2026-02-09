export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message, playerName } = req.body;

  try {
    const dbHeaders = {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    };

    // 1. SESSION MANAGEMENT
    const userQuery = playerName || "Anonymous_Prisoner";
    const dbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.${userQuery}&select=*`, { headers: dbHeaders });
    const dbData = await dbRes.json();
    let state = dbData[0] || { player_name: userQuery, minutes_left: 180, has_bribe_item: false, is_cell_locked: true };
    let newTime = Math.max(0, (state.minutes_left || 180) - 1);

    // 2. AI PERSONA & ESCAPE LOGIC
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ 
          role: "system", 
          content: `You are Dorn the Jailor. Cockney, abusive, predatory. 
          WORLD: Bribe=${state.has_bribe_item}, Door=${state.is_cell_locked ? 'LOCKED' : 'OPEN'}.
          LOGIC: 
          1. If they offer the ring AND door is LOCKED, unlock it and end with TRIGGER_CELL_OPEN.
          2. If door is OPEN and they say they are leaving/stepping out, end with TRIGGER_ESCAPE.
          VOICE: Short sentences. Use contractions.` 
        }, { role: "user", content: message }]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0]?.message?.content || "Dorn snorts.";
    let updates = { minutes_left: newTime };
    let escapeTriggered = false;

    if (reply.includes('TRIGGER_CELL_OPEN')) {
        updates.is_cell_locked = false;
        reply = reply.replace('TRIGGER_CELL_OPEN', '').trim();
    }
    if (reply.includes('TRIGGER_ESCAPE')) {
        escapeTriggered = true;
        reply = "Go on then, get out of my sight before I change my mind...";
    }

    // 3. ELEVENLABS VOICE (V2 MODEL)
    let audioBase64 = null;
    let voiceStatus = "OFFLINE";

    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/1TE7ou3jyxHsyRehUuMB`, {
          method: "POST",
          headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: reply,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
          })
        });

        if (voiceRes.ok) {
          const audioBuffer = await voiceRes.arrayBuffer();
          audioBase64 = Buffer.from(audioBuffer).toString('base64');
          voiceStatus = "SUCCESS";
        } else {
          voiceStatus = `ERR_${voiceRes.status}`;
        }
      } catch (e) { voiceStatus = "TIMEOUT"; }
    }

    // 4. DATABASE PERSISTENCE
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states`, {
      method: "POST",
      headers: { ...dbHeaders, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ ...state, ...updates })
    });

    res.status(200).json({ 
        reply, 
        audio: audioBase64, 
        voice_diag: voiceStatus, 
        minutes_left: newTime,
        is_escaped: escapeTriggered,
        is_locked: updates.is_cell_locked ?? state.is_cell_locked
    });

  } catch (err) {
    res.status(200).json({ reply: `[DORN_ERR: ${err.message}]` });
  }
}
