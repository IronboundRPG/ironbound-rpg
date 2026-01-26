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
        messages: [{ role: "system", content: `You are Dorn the Jailor. Cockney, abusive, predatory. VOICE: Short sentences. Use contractions.` }, { role: "user", content: message }]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices[0]?.message?.content || "Dorn just sneers.";
    
    // ATTEMPT VOICE: If it fails, we keep going
    let audioBase64 = null;
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/1TE7ou3jyxHsyRehUuMB`, {
          method: "POST",
          headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ text: reply, model_id: "eleven_monolingual_v1" })
        });
        if (voiceRes.ok) {
          const audioBuffer = await voiceRes.arrayBuffer();
          audioBase64 = Buffer.from(audioBuffer).toString('base64');
        }
      } catch (e) { console.log("Voice API bypassed."); }
    }

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/ironbound_states?player_name=eq.Darren`, {
      method: "PATCH", headers: dbHeaders, body: JSON.stringify({ minutes_left: newTime })
    });

    res.status(200).json({ reply, audio: audioBase64, minutes_left: newTime, is_locked: state.is_cell_locked });

  } catch (err) {
    res.status(200).json({ reply: "[DORN_OFFLINE: CHECK VERCEL LOGS]" });
  }
}
