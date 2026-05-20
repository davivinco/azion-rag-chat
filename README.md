# Azion RAG Chat

Aplicação RAG criada com Next.js e executada na Azion Edge, utilizando AI Inference, Edge SQL e Vector Search para ingestão, indexação, busca semântica e geração de respostas com contexto.

O objetivo deste projeto é demonstrar um fluxo RAG funcional rodando 100% na arquitetura de Edge da Azion, sem depender de um backend tradicional centralizado para execução da aplicação, busca vetorial ou inferência.

---

## Visão geral

Este projeto implementa um assistente com Retrieval-Augmented Generation, ou RAG.

O fluxo principal é:

```txt
Documento
→ extração de texto
→ divisão em chunks
→ geração de embeddings
→ persistência no Edge SQL
→ busca vetorial
→ recuperação de contexto
→ resposta final com LLM
```

Na implementação atual:

```txt
Next.js Application
→ roda na Azion Edge

AI Inference - Qwen3 Embedding 4B
→ gera embeddings dos chunks e perguntas

Azion SQL Database / Edge SQL
→ armazena documentos, chunks e vetores

Azion SQL Database Vector Search
→ recupera chunks semanticamente relevantes

AI Inference - Mistral Small
→ gera a resposta final usando o contexto recuperado
```

---

## Por que isso funciona 100% na Edge

A Azion permite que esse projeto rode na Edge porque combina três capacidades principais:

### 1. Edge Application

A aplicação Next.js é publicada na Azion e executada próxima do usuário, usando runtime de Edge.

Isso permite que as rotas da aplicação, como `/api/chat`, `/api/ingest` e `/api/knowledge/upload`, sejam processadas sem um servidor Node.js tradicional dedicado.

### 2. AI Inference na Edge

O projeto usa endpoints de AI Inference da Azion para duas funções diferentes:

```txt
Qwen3 Embedding 4B
→ transforma textos em vetores numéricos

Mistral Small
→ gera a resposta final em linguagem natural
```

A separação é importante:

```txt
Embedding model
→ usado para busca semântica

Chat model
→ usado para responder ao usuário
```

Ou seja, o Qwen3 não responde a pergunta final. Ele transforma textos em vetores.

O Mistral recebe a pergunta + contexto recuperado e gera a resposta.

### 3. Edge SQL com Vector Search

O Edge SQL é usado como camada persistente da base de conhecimento.

Ele armazena:

```txt
documentos
chunks textuais
embeddings vetoriais
metadados
```

A busca vetorial permite comparar o embedding da pergunta com os embeddings dos chunks usando distância/similaridade vetorial.

Na prática:

```txt
Pergunta do usuário
→ embedding da pergunta
→ comparação com embeddings salvos
→ top chunks mais relevantes
→ contexto enviado ao LLM
```

Assim, a aplicação não precisa de um banco vetorial externo como Pinecone, Weaviate ou Chroma para o POC.

---

## Arquitetura

```txt
Usuário
  |
  v
Azion Edge Application - Next.js
  |
  |-- /api/knowledge/upload
  |     |-- recebe .txt, .md, .html, .htm
  |     |-- extrai texto
  |     |-- gera chunks
  |     |-- gera embeddings via AI Inference
  |     |-- salva no Edge SQL
  |
  |-- /api/ingest
  |     |-- recebe texto bruto
  |     |-- gera chunks
  |     |-- gera embeddings
  |     |-- salva no Edge SQL
  |
  |-- /api/chat
  |     |-- recebe pergunta
  |     |-- gera embedding da pergunta
  |     |-- busca chunks similares no Edge SQL
  |     |-- envia contexto ao Mistral
  |     |-- retorna resposta + fontes + chunks
  |
  |-- /api/knowledge/list
  |     |-- lista documentos indexados
  |
  |-- /api/knowledge/delete
        |-- remove documento, chunks e embeddings
```

---

## Componentes principais

### Frontend

```txt
app/page.tsx
```

Interface principal do chat.

Mostra:

```txt
campo de pergunta
resposta do modelo
fontes utilizadas
contexto recuperado
scores dos chunks
```

### Gestão da base de conhecimento

```txt
app/knowledge/page.tsx
```

Interface para gestão mínima da base.

Permite:

```txt
upload de arquivos .txt, .md, .html e .htm
listar documentos indexados
remover documentos
```

### API de chat

```txt
app/api/chat/route.ts
```

Recebe a pergunta do usuário e chama o pipeline RAG.

Retorna:

```json
{
  "ok": true,
  "mode": "edge-sql-vector-rag",
  "answer": "...",
  "sources": [],
  "chunks": []
}
```

### API de ingestão

```txt
app/api/ingest/route.ts
```

Recebe texto puro via JSON e indexa na base.

Exemplo:

```bash
curl -X POST https://SEU_DOMINIO/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "source": "documento.txt",
    "text": "Conteúdo do documento",
    "chunkSize": 1200,
    "overlap": 180,
    "generateEmbeddings": true
  }'
```

### API de upload

```txt
app/api/knowledge/upload/route.ts
```

Recebe arquivo via `multipart/form-data`.

Formatos suportados atualmente:

```txt
.txt
.md
.html
.htm
```

Exemplo:

```bash
curl -X POST https://SEU_DOMINIO/api/knowledge/upload \
  -F "file=@/tmp/base-teste.txt;type=text/plain"
```

### API de listagem

```txt
app/api/knowledge/list/route.ts
```

Lista documentos registrados na base.

Exemplo:

```bash
curl -X GET https://SEU_DOMINIO/api/knowledge/list
```

### API de remoção

```txt
app/api/knowledge/delete/route.ts
```

Remove um documento da base, incluindo:

```txt
registro do documento
chunks textuais
embeddings
```

Exemplo:

```bash
curl -X POST https://SEU_DOMINIO/api/knowledge/delete \
  -H "Content-Type: application/json" \
  -d '{
    "source": "documento.txt"
  }'
```

---

## Estrutura de arquivos

```txt
app/
  api/
    chat/
      route.ts
    ingest/
      route.ts
    knowledge/
      upload/
        route.ts
      list/
        route.ts
      delete/
        route.ts
  knowledge/
    page.tsx
  page.tsx

lib/
  rag/
    answer.ts
    embeddings.ts
    file-text.ts
    llm.ts
    retrieve.ts
    split.ts
    store.ts
    types.ts
    vector-store.ts

scripts/
  ingest-pdf.mjs
```

---

## Lógica do RAG

### 1. Upload ou ingestão

O usuário pode enviar conteúdo por:

```txt
/api/ingest
/api/knowledge/upload
scripts/ingest-pdf.mjs
```

O conteúdo é transformado em texto.

### 2. Chunking

O texto é dividido em trechos menores.

Arquivo responsável:

```txt
lib/rag/split.ts
```

A divisão usa:

```txt
chunkSize
overlap
limite por palavra
```

Isso evita cortar palavras no meio e melhora a qualidade do contexto.

### 3. Embeddings

Cada chunk é enviado para o endpoint de embeddings.

Arquivo responsável:

```txt
lib/rag/embeddings.ts
```

Modelo usado:

```txt
Qwen/Qwen3-Embedding-4B
```

Endpoint:

```txt
/v1/embeddings
```

Header usado no POC:

```txt
X-API-Key
```

Exemplo de configuração:

```txt
EMBEDDINGS_API_URL=https://SEU_ENDPOINT/v1/embeddings
EMBEDDINGS_API_KEY=SEU_TOKEN
EMBEDDINGS_API_KEY_HEADER=X-API-Key
EMBEDDINGS_MODEL=Qwen/Qwen3-Embedding-4B
EMBEDDINGS_DIMENSIONS=256
```

### 4. Persistência

O projeto grava informações no Edge SQL.

Tabelas usadas:

```txt
rag_documents
rag_chunks
rag_chunk_embeddings
```

### 5. Busca vetorial

Quando o usuário faz uma pergunta:

```txt
pergunta
→ embedding da pergunta
→ busca vetorial no Edge SQL
→ chunks mais próximos
```

Arquivo responsável:

```txt
lib/rag/vector-store.ts
```

A busca usa distância cosseno.

O score é calculado como:

```txt
score = 1 - distance
```

Para evitar retorno de documentos irrelevantes, foi adicionado um filtro mínimo:

```txt
minScore = 0.6
```

Assim, o sistema evita trazer documentos apenas porque estão entre os top 5, mesmo que sejam pouco relevantes.

### 6. Geração da resposta

Depois que os chunks são recuperados, eles são enviados como contexto para o modelo de chat.

Arquivo responsável:

```txt
lib/rag/llm.ts
```

Modelo usado:

```txt
casperhansen-mistral-small-24b-instruct-2501-awq
```

Endpoint:

```txt
/v1/chat/completions
```

A instrução do sistema força o modelo a responder somente com base no contexto recuperado.

---

## Banco de dados

### Tabela `rag_documents`

Guarda metadados dos documentos.

```sql
CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER,
  status TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela `rag_chunks`

Guarda os chunks textuais.

```sql
CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela `rag_chunk_embeddings`

Guarda embeddings vetoriais.

```sql
CREATE TABLE rag_chunk_embeddings (
  chunk_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding F32_BLOB(256),
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

Índice vetorial:

```sql
CREATE INDEX IF NOT EXISTS rag_chunk_embeddings_idx
ON rag_chunk_embeddings (
  libsql_vector_idx(embedding, 'metric=cosine')
);
```

---

## Variáveis de ambiente

Essas variáveis precisam existir no runtime da Azion.

```txt
AZION_PERSONAL_TOKEN=
EDGE_SQL_DATABASE_ID=

EMBEDDINGS_API_URL=
EMBEDDINGS_API_KEY=
EMBEDDINGS_API_KEY_HEADER=X-API-Key
EMBEDDINGS_MODEL=Qwen/Qwen3-Embedding-4B
EMBEDDINGS_DIMENSIONS=256

CHAT_API_URL=
CHAT_API_KEY=
CHAT_API_KEY_HEADER=X-API-Key
CHAT_MODEL=casperhansen-mistral-small-24b-instruct-2501-awq
```

Exemplo local:

```bash
cat > .env.local <<'ENV'
AZION_PERSONAL_TOKEN=SEU_TOKEN
EDGE_SQL_DATABASE_ID=1770

EMBEDDINGS_API_URL=https://SEU_ENDPOINT/v1/embeddings
EMBEDDINGS_API_KEY=SEU_TOKEN
EMBEDDINGS_API_KEY_HEADER=X-API-Key
EMBEDDINGS_MODEL=Qwen/Qwen3-Embedding-4B
EMBEDDINGS_DIMENSIONS=256

CHAT_API_URL=https://SEU_ENDPOINT/v1/chat/completions
CHAT_API_KEY=SEU_TOKEN
CHAT_API_KEY_HEADER=X-API-Key
CHAT_MODEL=casperhansen-mistral-small-24b-instruct-2501-awq
ENV
```

Importante: `.env.local` não deve ser commitado.

---

## Deploy

O deploy é feito via GitHub Actions.

Workflow:

```txt
.github/workflows/main.yml
```

O workflow:

```txt
faz checkout do repositório
instala Node.js
instala dependências
instala Azion CLI
executa azion deploy
```

Para rodar corretamente:

```txt
GitHub
→ Actions
→ Azion Deploy
→ Run workflow
→ branch main
→ Run workflow
```

Não usar `Re-run all jobs` para publicar versão nova, porque isso reroda uma execução antiga com commit antigo.

---

## Comandos úteis

### Build local

```bash
rm -rf .next
npm run build
```

### Commit e push

```bash
git status
git add .
git commit -m "mensagem do commit"
git push origin main
```

### Testar upload

```bash
curl -X POST https://SEU_DOMINIO/api/knowledge/upload \
  -F "file=@/tmp/base-teste.txt;type=text/plain"
```

### Listar base

```bash
curl -X GET https://SEU_DOMINIO/api/knowledge/list
```

### Remover documento

```bash
curl -X POST https://SEU_DOMINIO/api/knowledge/delete \
  -H "Content-Type: application/json" \
  -d '{
    "source": "base-teste.txt"
  }'
```

### Perguntar ao RAG

```bash
curl -X POST https://SEU_DOMINIO/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Quais formatos a base de conhecimento suporta no upload?"
  }'
```

---

## Ingestão de PDF

O upload via interface suporta inicialmente:

```txt
.txt
.md
.html
.htm
```

Para PDF, o projeto inclui um script local:

```txt
scripts/ingest-pdf.mjs
```

Esse script:

```txt
lê o PDF localmente
extrai texto
envia para /api/ingest
gera chunks
gera embeddings
salva no Edge SQL
```

Exemplo:

```bash
node scripts/ingest-pdf.mjs "/Users/seu.usuario/Downloads/documento.pdf"
```

Esse caminho foi escolhido porque parsing de PDF dentro de runtime Edge pode ser mais pesado e menos previsível. Para o POC, extrair localmente e enviar o texto para a Edge é mais simples e estável.

---

## Limitações atuais

### 1. Download do arquivo original

Hoje o projeto gerencia documentos, chunks e embeddings, mas ainda não salva o binário original do arquivo.

Por isso, o download real do arquivo original ainda não está implementado.

Próxima evolução recomendada:

```txt
salvar arquivo original no Azion Object Storage
salvar metadados no Edge SQL
usar /api/knowledge/download para recuperar o arquivo
```

### 2. PDF via upload web

O PDF já é suportado via script local, mas ainda não diretamente no endpoint `/api/knowledge/upload`.

Próxima evolução:

```txt
upload PDF
→ salvar no Object Storage
→ processar texto
→ indexar no Edge SQL
```

### 3. Filtro de relevância

A busca vetorial usa `minScore = 0.6`.

Esse valor pode ser ajustado:

```txt
0.55 → mais permissivo
0.60 → equilíbrio para POC
0.70 → mais restritivo
```

---

## Fluxo final validado

O projeto já validou:

```txt
Application na Azion
Deploy via GitHub Actions
Upload de arquivos textuais
Ingestão manual
Ingestão de PDF via script local
Geração de embeddings com Qwen3
Persistência no Edge SQL
Busca vetorial
Resposta final com Mistral
Exibição de fontes e contexto recuperado
Gestão mínima da base de conhecimento
```

---

## Próximos passos

Melhorias recomendadas:

```txt
1. Adicionar Object Storage para salvar arquivos originais
2. Implementar download real
3. Adicionar upload direto de PDF pela interface
4. Criar autenticação para a área /knowledge
5. Adicionar reprocessamento de documento
6. Adicionar status de indexing: pending, processing, indexed, failed
7. Adicionar limpeza automática de documentos de teste
8. Melhorar ranking com reranker
9. Adicionar filtros por documento/fonte
10. Criar logs de ingestão e consulta
```

---

## Resumo técnico

Este projeto demonstra que é possível criar uma aplicação RAG usando a stack da Azion de ponta a ponta:

```txt
Edge Application
+ AI Inference
+ Edge SQL
+ Vector Search
+ GitHub Actions
```

A aplicação roda na Edge, gera embeddings via AI Inference, persiste vetores no Edge SQL, faz busca semântica próxima do usuário e usa o modelo de chat para gerar respostas contextualizadas.
