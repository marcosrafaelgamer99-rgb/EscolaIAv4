// Vercel Serverless Function — roda no servidor, sem CORS
// Novo endpoint router.huggingface.co (api-inference foi descontinuado)
export default async function handler(req, res) {
  // Apenas POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.VITE_HF_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'VITE_HF_TOKEN não configurado no servidor.' });
  }

  const { messages, agentId } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Campo "messages" inválido ou ausente.' });
  }

  try {
    // Novo roteador HuggingFace (router.huggingface.co)
    const HF_URL = 'https://router.huggingface.co/v1/chat/completions';

    const hfRes = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        messages,
        max_tokens: 3000,
        temperature: 0.6
      })
    });

    if (!hfRes.ok) {
      const errBody = await hfRes.json().catch(() => ({}));
      const detail = errBody.error || errBody.message || `HTTP ${hfRes.status}`;
      console.error(`[API] Agente ${agentId} — HF retornou ${hfRes.status}:`, errBody);
      return res.status(502).json({ error: `HuggingFace retornou erro: ${detail}` });
    }

    const data = await hfRes.json();
    const content = data.choices[0].message.content;
    console.log(`[API] Agente ${agentId} concluído com sucesso.`);
    return res.status(200).json({ content });
  } catch (err) {
    console.error(`[API] Agente ${agentId} falhou:`, err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
  }
}
