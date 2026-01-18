import { createClient } from '@supabase/supabase-js';

// Initialize the "Vault" connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { message } = req.body;

  // 1. DATA FETCH: Check the "Source of Truth"
  const { data: state, error } = await supabase
    .from('ironbound_states')
    .select('*')
    .eq('player_name', 'Darren') // Hardcoded for your test
    .single();

  if (error) {
    console.error("Database Error:", error);
    return res.status(500).json({ reply: "[ THE SYSTEM STUTTERS... DB ERROR ]" });
  }

  // 2. LOGIC-GATE: Determine the "Hardened" behavior
  // If the DB says they have no bribe, they are stuck in GUARDED mode.
  const isTrusted = state.has_bribe_item === true;
  const currentMode = isTrusted ? "TRUSTED" : "GUARDED";

  // 3. BRAIN: Send the message with the Database-driven context
  try {
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
            CURRENT STATE: ${currentMode}. 
            RULES: If STATE is GUARDED, you must mock the player's lack of gold and refuse to open the cell. 
            If STATE is TRUSTED, you may take their bribe and unlock the door. 
            The player claims: "${message}". Check their STATE before responding.` 
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await response.json();
    res.status(200).json({ 
      reply: aiData.choices[0].message.content,
      gate_state: currentMode // Sending this back so the UI can update!
    });

  } catch (error) {
    res.status(500).json({ error: 'Signal lost' });
  }
}
