// Vercel Serverless Function — roda no servidor, sem CORS
// v4.0.8 — modelo HuggingFaceH4/zephyr-7b-beta com template correto

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.VITE_HF_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'VITE_HF_TOKEN não configurado no servidor Vercel.' });
  }

  const { messages, agentId } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Campo "messages" inválido ou ausente.' });
  }

  console.log(`[API v4.0.8] Agente ${agentId} iniciado. Token: Bearer ${token.slice(0, 8)}...`);

  // Zephyr usa o chat template padrão OpenAI — router.huggingface.co aceita direto
  // com o formato messages[], sem precisar montar prompt manualmente
  const HF_URL = 'https://router.huggingface.co/v1/chat/completions';

  let hfRes;
  try {
    hfRes = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'HuggingFaceH4/zephyr-7b-beta',
        messages,           // formato OpenAI: [{role, content}] — Zephyr aceita nativamente
        max_tokens: 1500,
        temperature: 0.7
      })
    });
  } catch (networkErr) {
    console.error(`[API] Agente ${agentId} — falha de rede:`, networkErr.message);
    return res.status(502).json({ error: `Falha de rede: ${networkErr.message}` });
  }

  // Lê como texto bruto para debug completo (evita [object Object])
  const rawText = await hfRes.text();
  console.log(`[API] Agente ${agentId} — status ${hfRes.status}. Body: ${rawText.slice(0, 300)}`);

  if (!hfRes.ok) {
    return res.status(502).json({
      error: `HuggingFace erro ${hfRes.status}: ${rawText}`
    });
  }

  try {
    const data = JSON.parse(rawText);
    const content = data.choices[0].message.content;
    console.log(`[API] Agente ${agentId} concluído com sucesso.`);
    return res.status(200).json({ content });
  } catch (parseErr) {
    return res.status(502).json({ error: `Resposta inválida: ${rawText}` });
  }
}
