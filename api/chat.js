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

    // 2. GENERATE DORN'S RESPONSE
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ 
          role: "system", 
          content: `You are Dorn the Jailor. Cockney, abusive, predatory. [cite: 17] 
          WORLD: Bribe=${state.has_bribe_item}, Door=${state.is_cell_locked ? 'LOCKED' : 'OPEN'}. [cite: 24, 25]
          LOGIC: If they give ring, end with TRIGGER_CELL_OPEN. 
          VOICE: Short sentences. Use contractions. [cite: 20] Signature: "It's more than my job's worth". [cite: 19]`
        }, { role: "user", content: message }]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0]?.message?.content || "Dorn grunts...";
    let updates = { minutes_left: newTime };

    if (reply.includes('TRIGGER_CELL_OPEN')) {
        updates.is_cell_locked = false;
        reply = reply.replace('TRIGGER_CELL_OPEN', '').trim();
    }

    // 3. GENERATE THE VOICE (ElevenLabs)
    // Replace 'YOUR_VOICE_ID' with a gravelly British ID from ElevenLabs
    const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpg8nEByWQX2l`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: reply,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.4, similarity_boost: 0.8 }
      })
    });

    const audioBuffer = await voiceRes.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    // 4. UPDATE DB
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren`, {
      method: "PATCH", headers: dbHeaders, body: JSON.stringify(updates)
    });

    res.status(200).json({ 
        reply, 
        audio: audioBase64, // Send the voice data to the UI
        is_locked: updates.is_cell_locked !== undefined ? updates.is_cell_locked : state.is_cell_locked,
        minutes_left: newTime
    });

  } catch (err) { res.status(200).json({ reply: "[DORN_SILENCED]" }); }
}
