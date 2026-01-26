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
        messages: [{ role: "system", content: "You are Dorn the Jailor. Cockney, abusive." }, { role: "user", content: message }]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0]?.message?.content || "Dorn snorts.";
    
    let audioBase64 = null;
    let voiceDiag = "KEY_NOT_FOUND";

    if (process.env.ELEVENLABS_API_KEY) {
      // DIAGNOSTIC LOG (Check this in Vercel Logs)
      const key = process.env.ELEVENLABS_API_KEY;
      console.log(`Diagnostic: Key starts with ${key.substring(0,3)} and ends with ${key.substring(key.length - 3)}`);
      
      try {
        const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/1TE7ou3jyxHsyRehUuMB`, {
          method: "POST",
          headers: { "xi-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({ text: reply, model_id: "eleven_monolingual_v1" })
        });

        if (voiceRes.ok) {
          const audioBuffer = await voiceRes.arrayBuffer();
          audioBase64 = Buffer.from(audioBuffer).toString('base64');
          voiceDiag = "SUCCESS";
        } else {
          voiceDiag = `ELEVENLABS_ERROR_${voiceRes.status}`;
          const errData = await voiceRes.json();
          console.error("ElevenLabs Detailed Error:", errData);
        }
      } catch (e) { voiceDiag = "FETCH_FAILED"; }
    }

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren`, {
      method: "PATCH", headers: dbHeaders, body: JSON.stringify({ minutes_left: newTime })
    });

    res.status(200).json({ reply, audio: audioBase64, voice_diag: voiceDiag, minutes_left: newTime });

  } catch (err) {
    res.status(200).json({ reply: `[DORN_ERR: ${err.message}]` });
  }
}
