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
        messages: [{ role: "system", content: "You are Dorn. Cockney jailor." }, { role: "user", content: message }]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0]?.message?.content || "Dorn snorts.";
    
    // THE KEY TEST
    // Try the Env Var first, then fallback to a placeholder string for testing
    const elKey = process.env.ELEVENLABS_API_KEY || "sk_e1f5939a2dd204759eca707e81daa5d3a088cd12b76ec34a";
    
    let audioBase64 = null;
    let voiceDiag = "STARTING";

    try {
      const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/1TE7ou3jyxHsyRehUuMB`, {
        method: "POST",
        headers: { "xi-api-key": elKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply, model_id: "eleven_monolingual_v1" })
      });

      if (voiceRes.ok) {
        const audioBuffer = await voiceRes.arrayBuffer();
        audioBase64 = Buffer.from(audioBuffer).toString('base64');
        voiceDiag = "SUCCESS";
      } else {
        const errorDetail = await voiceRes.json();
        // This sends the EXACT ElevenLabs error message to your game UI
        voiceDiag = `ERR_${voiceRes.status}: ${errorDetail.detail?.status || 'Unauthorized'}`;
      }
    } catch (e) {
      voiceDiag = "FETCH_CRASHED";
    }

    res.status(200).json({ reply, audio: audioBase64, voice_diag: voiceDiag, minutes_left: newTime });

  } catch (err) {
    res.status(200).json({ reply: `[SYSTEM_CRASH: ${err.message}]` });
  }
}
