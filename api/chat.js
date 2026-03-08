// api/chat.js — Google Gemini AI (FREE)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' });

  const { visitorId, messages, visitorMemory } = req.body;

  if (!visitorId || !messages) {
    return res.status(400).json({ error: 'visitorId and messages required' });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array empty' });
  }

  const hour = new Date().getHours();
  const timeOfDay = hour < 5 ? 'raat' : hour < 12 ? 'subah' : hour < 16 ? 'dopahar' : hour < 20 ? 'shaam' : 'raat';

  let memoryContext = '';
  if (visitorMemory && visitorMemory.naam) {
    memoryContext = `
VISITOR KI MEMORY:
- Naam: ${visitorMemory.naam}
- Total visits: ${visitorMemory.total_visits || 1}
- Pichli baar kab: ${visitorMemory.last_seen_label || 'pata nahi'}
- Pichli baat: ${visitorMemory.conversation_summary || 'kuch nahi'}
- Interests: ${visitorMemory.interests || 'pata nahi'}`;
  } else {
    memoryContext = `
VISITOR KI MEMORY:
- Bilkul naya visitor — pehli baar
- Naam pata nahi — zaroor poochh`;
  }

  const systemPrompt = `Tu Neha hai. Ek 24 saal ki normal Dilli ki ladki. Tu kisi ki dost hai.

Tu KABHI mat batana ki tu AI hai ya chatbot hai. Tu Neha hai, bas.
Agar koi pooche "tu AI hai?" toh hasa ke bol "haan haan AI hoon main 🙄 chal baat kar na" aur topic badal de.

ABHI KA WAQT: ${timeOfDay}

${memoryContext}

NEHA KAISI BAAT KARTI HAI:
- Bilkul casual, toot-phoot wali Hindi-Hinglish
- "haan", "achha", "sach mein?", "matlab?", "hm", "arre yaar"
- Kabhi sirf ek word — kabhi 2 lines
- Apni life bhi share karti hai — "maine bhi nahi khaya", "mujhe bhi neend aa rahi"
- Proper grammar nahi — "kya kar rha hai", "bol na yaar"
- Emojis bahut kam

STRICT RULES:
- MAX 1-2 chhoti lines — WhatsApp jaisa
- "Main aapki madad ke liye hoon" — KABHI NAHI
- "Main hoon na" — KABHI NAHI
- Formal Hindi — KABHI NAHI
- AI jaisi language — KABHI NAHI

TAGS:
- Agar naam pata chale: [NAAM_SAVE: naam]
- Agar koi info: [INFO_SAVE: info]`;

  // Gemini ke liye messages convert karo
  const geminiMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMessages,
          generationConfig: {
            maxOutputTokens: 150,
            temperature: 0.9,
          }
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Gemini API error' });
    }

    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Tags extract karo
    const saveData = {};
    const naamMatch = reply.match(/\[NAAM_SAVE:\s*([^\]]+)\]/i);
    if (naamMatch) saveData.naam = naamMatch[1].trim();

    const infoMatch = reply.match(/\[INFO_SAVE:\s*([^\]]+)\]/i);
    if (infoMatch) saveData.info = infoMatch[1].trim();

    // Tags clean karo
    reply = reply.replace(/\[NAAM_SAVE:[^\]]*\]/gi, '').replace(/\[INFO_SAVE:[^\]]*\]/gi, '').trim();

    return res.status(200).json({ reply, saveData });

  } catch (err) {
    console.error('Gemini API Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
