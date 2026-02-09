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
          content: `You are Dorn the Jailor. Cockney, abusive.
          WORLD: HasRing=${state.has_bribe_item}, DoorLocked=${state.is_cell_locked}.
          LOGIC:
          1. If they search the straw, they find the Signet Ring. End with TRIGGER_RING_FOUND.
          2. If they offer the ring, unlock the door. End with TRIGGER_CELL_OPEN.
          3. If door is OPEN and they leave, end with TRIGGER_ESCAPE.`
        }, { role: "user", content: message }]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0]?.message?.content || "Dorn snorts.";
    let updates = { minutes_left: Math.max(0, state.minutes_left - 1) };
    let escaped = false;

    if (reply.includes('TRIGGER_RING_FOUND')) {
        updates.has_bribe_item = true;
        reply = reply.replace('TRIGGER_RING_FOUND', '').trim();
    }
    if (reply.includes('TRIGGER_CELL_OPEN')) {
        updates.is_cell_locked = false;
        reply = reply.replace('TRIGGER_CELL_OPEN', '').trim();
    }
    if (reply.includes('TRIGGER_ESCAPE') && !state.is_cell_locked) {
        escaped = true;
        reply = "Go on then, before I change my mind.";
    }

    // PERSIST
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states`, {
      method: "POST",
      headers: { ...dbHeaders, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ ...state, ...updates })
    });

    // VOICE (Multilingual v2)
    let audioBase64 = null;
    let voiceStatus = "OFFLINE";
    if (process.env.ELEVENLABS_API_KEY) {
      const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/1TE7ou3jyxHsyRehUuMB`, {
        method: "POST",
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply, model_id: "eleven_multilingual_v2" })
      });
      if (voiceRes.ok) {
        const buf = await voiceRes.arrayBuffer();
        audioBase64 = Buffer.from(buf).toString('base64');
        voiceStatus = "SUCCESS";
      } else { voiceStatus = `ERR_${voiceRes.status}`; }
    }

    res.status(200).json({ reply, audio: audioBase64, voice_diag: voiceStatus, is_escaped: escaped, minutes_left: updates.minutes_left });
  } catch (err) { res.status(200).json({ reply: `[DORN_SILENCED: ${err.message}]` }); }
}
