import { HfInference } from '@huggingface/inference';

// Vercel Serverless Function — roda no servidor, sem CORS
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
    // HfInference roda aqui no servidor — sem restrição de CORS
    const hf = new HfInference(token);
    const result = await hf.chatCompletion({
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      messages,
      max_tokens: 3000,
      temperature: 0.6
    });

    const content = result.choices[0].message.content;
    console.log(`[API] Agente ${agentId} concluído com sucesso.`);
    return res.status(200).json({ content });
  } catch (err) {
    console.error(`[API] Agente ${agentId} falhou:`, err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
  }
}
