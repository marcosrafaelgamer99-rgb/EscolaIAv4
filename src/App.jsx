import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// ─── Agentes do Pipeline ──────────────────────────────────────────────────────
const AGENTS = [
  {
    id: 1,
    name: 'BASE',
    sysMsg: 'Você é o Agente 1 (Base de Conhecimento). Responda ao tema com profundidade usando apenas seu conhecimento interno. Nenhuma ferramenta externa.'
  },
  {
    id: 2,
    name: 'ANALISTA',
    sysMsg: 'Você é o Agente 2 (Analista Crítico). Avalie o texto recebido. Aponte lacunas, imprecisões ou dados incompletos de forma objetiva e numerada.'
  },
  {
    id: 3,
    name: 'REESCRITOR',
    sysMsg: 'Você é o Agente 3 (Reescritor). Reescreva o conteúdo de forma impecável, corrigindo todos os pontos levantados pelo Analista.'
  },
  {
    id: 4,
    name: 'FINALIZADOR',
    sysMsg: 'Você é o Agente 4 (Finalizador). Entregue ao Marcos o conteúdo com formatação markdown clara, uma frase de abertura amigável e uma de encerramento.'
  }
];

// ─── Chamada ao proxy /api/chat (mesma origem = zero CORS) ───────────────────
async function callAgent(agentId, systemMsg, userContent) {
  console.log(`[EscolaIA] Agente ${agentId} iniciado.`);

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user',   content: userContent }
      ]
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Agente ${agentId} retornou HTTP ${res.status}`);
  }

  console.log(`[EscolaIA] Agente ${agentId} concluído.`);
  return data.content;
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

    try {
      let carry = `Tema solicitado por Marcos: ${query}`;

      for (const agent of AGENTS) {
        setAgentLabel(`Agente ${agent.id} processando...`);

        // response.choices[0].message.content vem pronto do proxy
        const content = await callAgent(agent.id, agent.sysMsg, carry);

        if (agent.id === 4) {
          // Apenas o Agente 4 exibe na interface
          addMsg('assistant', content);
        } else {
          // Agentes 1-3: passam o conteúdo para o próximo em silêncio
          carry = `Material do estágio anterior:\n\n${content}`;
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

  // ─── Render ────────────────────────────────────────────────────────────────
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

      <span className="version-tag">v4.0.4</span>
    </div>
  );
}
