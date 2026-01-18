import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with the built-in environment variables
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;

  try {
    // 1. DATA FETCH: Check the "Source of Truth"
    const { data: state, error: dbError } = await supabase
      .from('ironbound_states')
      .select('*')
      .eq('player_name', 'Darren')
      .single();

    if (dbError) {
      console.error("Database Error:", dbError);
      return res.status(200).json({ reply: `[SYSTEM ERROR: DATABASE_UNREACHABLE] ${dbError.message}` });
    }

    const currentMode = state.has_bribe_item ? "TRUSTED" : "GUARDED";

    // 2. BRAIN: Talk to OpenRouter using native fetch
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are the Ironbound DM. Fingerprint: GRIM_BUREAUCRAT. 
            MANDATORY: You must start every response with [STATE: ${currentMode}].
            If STATE is GUARDED, you must mock the player. 
            If STATE is TRUSTED, you must accept the bribe and open the door.` 
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await response.json();
    
    if (aiData.error) {
       return res.status(200).json({ reply: `[AI ERROR: ${aiData.error.message}]` });
    }

    res.status(200).json({ reply: aiData.choices[0].message.content });

  } catch (error) {
    console.error("General Error:", error);
    res.status(500).json({ reply: "[ THE SIGNAL DISSIPATED INTO THE VOID ]" });
  }
}
