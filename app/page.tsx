export const runtime = "edge";

"use client";

import { useState } from "react";

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

async function handleSend() {
  if (!question.trim()) return;

  setLoading(true);
  setResponse("");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: question }),
    });

    const data = await res.json();

    if (!res.ok) {
   setResponse(
  data?.details
    ? `${data?.error ?? "Erro"}\n\nDetalhes: ${data.details}`
    : data?.error ?? "Erro ao processar a solicitação."
);
      return;
    }

    setResponse(data.answer ?? "Sem resposta.");
  } catch (error) {
    setResponse("Erro ao chamar a API.");
  } finally {
    setLoading(false);
  }
}

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-neutral-900 rounded-2xl shadow-xl p-6 border border-neutral-800">
        <h1 className="text-3xl font-bold mb-2">Azion RAG Chat</h1>
        <p className="text-neutral-400 mb-6">
          Interface inicial do assistente com RAG
        </p>

        <div className="flex flex-col gap-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Digite sua pergunta..."
            className="w-full min-h-[140px] rounded-xl bg-neutral-950 border border-neutral-700 p-4 text-white outline-none focus:border-neutral-500 resize-none"
          />

          <button
            onClick={handleSend}
            disabled={loading}
            className="rounded-xl bg-white text-black font-medium px-4 py-3 disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar"}
          </button>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 min-h-[180px]">
            <p className="text-sm text-neutral-400 mb-2">Resposta</p>
            <div className="whitespace-pre-wrap text-neutral-100">
              {response || "A resposta aparecerá aqui."}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}