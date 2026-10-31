-- BaraWatch · 0007 · Basis pengetahuan chatbot (Fase 3)
-- Boleh ditunda sampai chatbot dikerjakan. Embedding dihasilkan FastAPI (/v1/chat).

create table public.kb_documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  issuer       text,
  source_url   text,
  published_at date,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.kb_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kb_documents(id) on delete cascade,
  page        integer,
  content     text not null,
  -- SESUAIKAN dimensi dengan model embedding yang dipilih. Nilai 1536 hanya placeholder.
  embedding   extensions.vector(1536)
);
create index kb_chunks_document_idx on public.kb_chunks (document_id);
-- Buat index vektor (HNSW) setelah dimensi final dan data terisi:
-- create index kb_chunks_embedding_idx on public.kb_chunks using hnsw (embedding extensions.vector_cosine_ops);
