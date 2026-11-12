-- 在同一個 Supabase 專案裡建立批改工具專用的資料表
create table if not exists essay_gradings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  subject text not null,
  question text not null,
  answer text not null,
  overall_score text,
  dimensions jsonb,
  paragraph_notes jsonb,
  summary text
);

-- 開啟 RLS，先給一個全開的 policy（個人本機工具用，之後若要公開部署再收緊）
alter table essay_gradings enable row level security;

create policy "allow all for anon on essay_gradings"
  on essay_gradings
  for all
  using (true)
  with check (true);

create index if not exists essay_gradings_subject_idx on essay_gradings (subject);
create index if not exists essay_gradings_created_at_idx on essay_gradings (created_at);
