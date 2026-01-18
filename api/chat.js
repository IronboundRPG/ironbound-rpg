export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ironbound-rpg.vercel.app", // For OpenRouter analytics
        "X-Title": "Ironbound RPG"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are the Ironbound DM. Your linguistic fingerprint is GRIM_BUREAUCRAT. No contractions. No helpful hints. You are in ACT I: THE JAIL. The player is on death row. Be cold, stoic, and brief." 
          },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("OpenRouter Error:", data.error);
      return res.status(500).json({ reply: "[ THE VOICES FADE... API ERROR ]" });
    }

    res.status(200).json({ reply: data.choices[0].message.content });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: 'Failed to reach the brain' });
  }
}
