import React, { useState, useRef, useEffect } from 'react';
import { HfInference } from '@huggingface/inference';
import './App.css';

// ─── Definição dos Agentes ────────────────────────────────────────────────────
const AGENTS = [
  {
    id: 1,
    name: 'BASE',
    sysMsg: 'Você é o Agente 1 (Base de Conhecimento). Responda ao tema com profundidade e riqueza de conteúdo, usando apenas seu conhecimento interno. Nenhuma ferramenta externa.'
  },
  {
    id: 2,
    name: 'ANALISTA',
    sysMsg: 'Você é o Agente 2 (Analista Crítico). Avalie o texto recebido e aponte lacunas, imprecisões ou dados incompletos de forma objetiva e numerada.'
  },
  {
    id: 3,
    name: 'REESCRITOR',
    sysMsg: 'Você é o Agente 3 (Reescritor). Com base no texto original e na crítica, reescreva o conteúdo de forma impecável, corrigindo todos os pontos levantados.'
  },
  {
    id: 4,
    name: 'FINALIZADOR',
    sysMsg: 'Você é o Agente 4 (Finalizador). Pegue o texto do estágio anterior e entregue ao Marcos com formatação markdown clara, uma frase de abertura amigável e uma de encerramento.'
  }
];

// ─── Chamada ao LLM via HfInference (sem fetch() manual, sem headers custom) ─
async function callAgent(hf, agentId, systemMsg, userContent) {
  console.log(`[EscolaIA] Agente ${agentId} (${AGENTS[agentId - 1].name}) iniciado.`);

  // Apenas o model ID — a biblioteca gerencia URL, headers e auth internamente
  const result = await hf.chatCompletion({
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user',   content: userContent }
    ],
    max_tokens: 3000,
    temperature: 0.6
  });

  const output = result.choices[0].message.content;
  console.log(`[EscolaIA] Agente ${agentId} concluído.`);
  return output;
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function App() {
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [running,    setRunning]    = useState(false);
  const [agentLabel, setAgentLabel] = useState('Sistema Online');
  const inputRef  = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMsg = (role, text) =>
    setMessages(prev => [...prev, { role, text, id: crypto.randomUUID() }]);

  const handleSend = async () => {
    if (!input.trim() || running) return;

    const query = input.trim();
    setInput('');
    setRunning(true);
    addMsg('user', query);

    // ── Validação do Token (F12 > Console para diagnóstico) ──────────────────
    const token = import.meta.env.VITE_HF_TOKEN;
    console.log('[EscolaIA] Token:', token ? `${token.slice(0, 8)}... (OK)` : 'AUSENTE — defina VITE_HF_TOKEN');

    if (!token) {
      addMsg('error', 'Token VITE_HF_TOKEN não encontrado. Configure no .env (desenvolvimento) ou nas variáveis da Vercel (produção).');
      setRunning(false);
      setAgentLabel('Sistema Online');
      return;
    }

    // ── Instancia o cliente UMA vez por requisição ───────────────────────────
    // HfInference gerencia auth, Content-Type e CORS sem configuração extra
    const hf = new HfInference(token);

    try {
      let carry = `Tema solicitado por Marcos: ${query}`;

      for (const agent of AGENTS) {
        setAgentLabel(`Agente ${agent.id} processando...`);

        try {
          const output = await callAgent(hf, agent.id, agent.sysMsg, carry);

          if (agent.id === 4) {
            // Apenas o resultado final do Agente 4 aparece na conversa
            addMsg('assistant', output);
          } else {
            // Resultado intermediário: passa em silêncio para o próximo agente
            carry = `Material do estágio anterior:\n\n${output}`;
          }
        } catch (agentErr) {
          console.error(`[EscolaIA] Agente ${agent.id} falhou:`, agentErr);
          throw new Error(`Agente ${agent.id} (${agent.name}) falhou: ${agentErr.message}`);
        }
      }
    } catch (e) {
      console.error('[EscolaIA] Pipeline interrompido:', e);
      addMsg('error', e.message);
    }

    setAgentLabel('Sistema Online');
    setRunning(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="shell">
      <div className="chat-wrapper">

        <header className="top-bar">
          <span className="brand">EscolaIA</span>
          <span className={`status-dot ${running ? 'busy' : 'online'}`}>
            <span className="dot-circle" />
            {agentLabel}
          </span>
        </header>

        <main className="messages">
          {messages.length === 0 && (
            <div className="empty-state">
              Olá, Marcos. O que vamos construir hoje?
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`bubble ${msg.role}`}>
              {msg.role === 'user'      && <span className="bubble-label">Você</span>}
              {msg.role === 'assistant' && <span className="bubble-label">EscolaIA</span>}
              <p className="bubble-text">{msg.text}</p>
            </div>
          ))}

          <div ref={bottomRef} />
        </main>

        <footer className="input-area">
          <div className="pill-wrap">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Digite sua mensagem..."
              disabled={running}
              rows={1}
              className="pill-input"
            />
            <button
              onClick={handleSend}
              disabled={running || !input.trim()}
              className="send-btn"
            >
              {running ? '●' : '↑'}
            </button>
          </div>
        </footer>

      </div>

      <span className="version-tag">v4.0.3</span>
    </div>
  );
}
