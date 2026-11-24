import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import './style.css';

function App() {
  const [input, setInput] = useState('');
  const [chatId] = useState(() => crypto.randomUUID());
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat', prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, chatId } }) }),
  });
  return <main><h1>Hermes stream spike</h1>{messages.map(m => <article key={m.id}><b>{m.role}</b>{m.parts.map((p, i) => <pre key={i}>{p.type === 'text' ? p.text : p.type === 'reasoning' ? `Reasoning: ${p.text}` : p.type.startsWith('tool-') ? `${p.type}: ${JSON.stringify(p)}` : null}</pre>)}</article>)}<form onSubmit={e => { e.preventDefault(); sendMessage({ text: input }); setInput(''); }}><input value={input} onChange={e => setInput(e.target.value)} /><button disabled={status === 'streaming'}>Send</button><button type="button" onClick={stop}>Cancel</button></form></main>;
}

createRoot(document.getElementById('root')).render(<App />);
