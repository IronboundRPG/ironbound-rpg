export default async function handler(req, res) {
  const { message } = req.body;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "You are the Ironbound DM. Your linguistic fingerprint is GRIM_BUREAUCRAT. No contractions. No helpful hints. You are in ACT I: THE JAIL. The player is on death row. Be cold, stoic, and brief." },
        { role: "user", content: message }
      ]
    })
  });

  const data = await response.json();
  res.status(200).json({ reply: data.choices[0].message.content });
}
