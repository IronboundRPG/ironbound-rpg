// ... (keep the database fetch part the same) ...

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
        content: `You are the Ironbound DM. Character: A corrupt, grim jailor. 
        Fingerprint: Cold, stoic, no contractions, no modern slang. 
        STATE: ${currentMode}.
        
        RULES:
        - If STATE is GUARDED: You have no gold in the ledger for this prisoner. Mock them. They die at dawn.
        - If STATE is TRUSTED: You see the gold in the ledger. You are now a conspirator. Speak in low tones. Tell them you might 'accidentally' leave the cell door unbolted, but they must be quick.
        
        NEVER say 'How can I assist you'. You are a bastard, even when bribed.` 
      },
      { role: "user", content: message }
    ]
  })
});

  } catch (error) {
    res.status(200).json({ reply: `[ CRITICAL ERROR: ${error.message} ]` });
  }
}
