// Vercel Serverless Function — roda no servidor, sem CORS
// v4.0.7 — debug completo com JSON.stringify no error handler

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

  // Log diagnóstico no servidor (visível nos logs da Vercel)
  console.log(`[API v4.0.7] Agente ${agentId} iniciado. Token: Bearer ${token.slice(0, 8)}...`);

  const HF_URL = 'https://router.huggingface.co/v1/chat/completions';

  let hfRes;
  try {
    hfRes = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        // Apenas os headers mínimos que o router do HF aceita
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/Mistral-7B-Instruct-v0.3',
        messages,
        max_tokens: 1500,
        temperature: 0.6
      })
    });
  } catch (networkErr) {
    // Falha de rede no servidor (raro, mas possível)
    console.error(`[API] Agente ${agentId} — falha de rede:`, networkErr.message);
    return res.status(502).json({ error: `Falha de rede ao contatar HuggingFace: ${networkErr.message}` });
  }

  // Lê o body da resposta UMA VEZ como texto para não perder dados
  const rawText = await hfRes.text();

  if (!hfRes.ok) {
    // Exibe o JSON completo — sem [object Object]
    console.error(`[API] Agente ${agentId} — HF retornou ${hfRes.status}:`, rawText);
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
    console.error(`[API] Agente ${agentId} — falha ao parsear JSON:`, rawText);
    return res.status(502).json({ error: `Resposta inválida da API: ${rawText}` });
  }
}
