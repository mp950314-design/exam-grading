-- 如果你是全新專案、還沒執行過 schema.sql，直接執行 schema.sql 就好，不用跑這份。
-- 如果你已經建過 essay_gradings 表，跑這段來補上「參考資料」欄位。
alter table essay_gradings
  add column if not exists reference_material text;
