-- 已經建過 essay_gradings 表的話，跑這段補上「使用模型」欄位。
-- 全新專案直接執行 schema.sql 即可，不用跑這份。
alter table essay_gradings
  add column if not exists model text;
