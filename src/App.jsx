import React, { useState, useRef, useEffect } from 'react';
import { HfInference } from '@huggingface/inference';
import './App.css';

const AGENTS = [
  {
    id: 1,
    name: 'BASE',
    sysMsg: 'Você é o Agente 1 (Base de Conhecimento). Responda ao tema com profundidade e riqueza de conteúdo, usando apenas seu conhecimento interno. Nenhuma ferramenta externa.'
  },
  {
    id: 2,
    name: 'ANALISTA',
    sysMsg: 'Você é o Agente 2 (Analista Crítico). Avalie o texto recebido. Aponte lacunas, imprecisões ou dados incompletos de forma objetiva e numerada.'
  },
  {
    id: 3,
    name: 'REESCRITOR',
    sysMsg: 'Você é o Agente 3 (Reescritor). Com base no texto original e na crítica, reescreva o conteúdo de forma impecável, corrigindo todos os pontos levantados.'
  },
  {
    id: 4,
    name: 'FINALIZADOR',
    sysMsg: 'Você é o Agente 4 (Finalizador). Pegue o texto do estágio anterior e entregue ao Marcos com formatação markdown clara e profissional, com uma frase de abertura amigável e outra de encerramento.'
  }
];

async function callLLM(hf, agentId, systemMsg, userContent) {
  console.log(`[EscolaIA] Agente ${agentId} iniciando via HfInference...`);

  // HfInference cuida dos headers, CORS e auth automaticamente
  const result = await hf.chatCompletion({
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userContent }
    ],
    max_tokens: 3000,
    temperature: 0.6
  });

  console.log(`[EscolaIA] Agente ${agentId} respondeu com sucesso.`);
  return result.choices[0].message.content;
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [agentLabel, setAgentLabel] = useState('Sistema Online');
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMsg = (role, text) =>
    setMessages(prev => [...prev, { role, text, id: Date.now() + Math.random() }]);

  const handleSend = async () => {
    if (!input.trim() || running) return;
    const query = input.trim();
    setInput('');
    setRunning(true);
    addMsg('user', query);

    // Diagnóstico do token — cheque em F12 > Console
    const token = import.meta.env.VITE_HF_TOKEN;
    console.log('[EscolaIA] Verificando VITE_HF_TOKEN...');
    if (!token) {
      console.error('[EscolaIA] VITE_HF_TOKEN está VAZIO ou não definido.');
      addMsg('error', 'Token VITE_HF_TOKEN ausente. Adicione-o no .env local (dev) ou nas variáveis de ambiente da Vercel (produção).');
      setRunning(false);
      setAgentLabel('Sistema Online');
      return;
    }
    console.log(`[EscolaIA] Token detectado: ${token.slice(0, 8)}...`);

    // Instancia o cliente HfInference com o token
    const hf = new HfInference(token);

    try {
      let carry = `Tema de Marcos: ${query}`;

      for (let i = 0; i < AGENTS.length; i++) {
        const agent = AGENTS[i];
        setAgentLabel(`Agente ${agent.id} processando...`);

        let output;
        try {
          output = await callLLM(hf, agent.id, agent.sysMsg, carry);
        } catch (agentErr) {
          console.error(`[EscolaIA] Agente ${agent.id} falhou:`, agentErr);
          throw new Error(`Erro de conexão com o Agente ${agent.id}. Detalhe: ${agentErr.message}`);
        }

        if (agent.id === 4) {
          addMsg('assistant', output);
        } else {
          carry = `Material do estágio anterior:\n\n${output}`;
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
              {msg.role === 'user' && <span className="bubble-label">Você</span>}
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
