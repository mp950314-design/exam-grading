import React, { useEffect, useState } from "react";
import { gradeEssay, SUBJECT_SUGGESTIONS } from "./lib/grader";
import { saveGrading, fetchHistory, averageBySubject, weakestDimensions } from "./lib/history";
import type { GradingRecord, GradingResult } from "./types";

type Tab = "grade" | "history";

export default function App() {
  const [tab, setTab] = useState<Tab>("grade");
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [referenceMaterial, setReferenceMaterial] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradingResult | null>(null);

  const [history, setHistory] = useState<GradingRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const canSubmit = subject.trim() && question.trim() && answer.trim() && !loading;

  async function handleGrade() {
    setLoading(true);
    setError(null);
    setResult(null);
    setStatusMessage(null);
    try {
      const graded = await gradeEssay(subject, question, answer, referenceMaterial, setStatusMessage);
      setResult(graded);
      await saveGrading(subject, question, answer, graded, referenceMaterial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "批改失敗，請再試一次。");
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const records = await fetchHistory();
      setHistory(records);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "讀取失敗。");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab]);

  const trends = averageBySubject(history);
  const weakDims = weakestDimensions(history);

  return (
    <div className="page">
      <header className="header">
        <div className="eyebrow">特考申論題批改</div>
        <h1 className="title">擬答批改台</h1>
        <nav className="tabs">
          <button
            className={tab === "grade" ? "tab active" : "tab"}
            onClick={() => setTab("grade")}
          >
            批改
          </button>
          <button
            className={tab === "history" ? "tab active" : "tab"}
            onClick={() => setTab("history")}
          >
            歷史紀錄
          </button>
        </nav>
      </header>

      {tab === "grade" && (
        <div className="grid">
          <section className="sheet">
            <label className="field">
              <span className="field-label">科目</span>
              <input
                list="subjects"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="例如：犯罪偵查學"
                className="input"
              />
              <datalist id="subjects">
                {SUBJECT_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>

            <label className="field">
              <span className="field-label">題目</span>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="貼上申論題題目"
                className="textarea"
                rows={3}
              />
            </label>

            <label className="field">
              <span className="field-label">擬答</span>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="貼上你的擬答全文"
                className="textarea lined"
                rows={12}
              />
            </label>

            <label className="field">
              <span className="field-label">參考資料（選填，但強烈建議提供）</span>
              <textarea
                value={referenceMaterial}
                onChange={(e) => setReferenceMaterial(e.target.value)}
                placeholder="貼上該題相關的法條原文、講義重點或官方參考答案。有提供的話，批改會以這份資料為準，避免亂引用法條號碼。"
                className="textarea"
                rows={6}
              />
            </label>

            <button className="submit" disabled={!canSubmit} onClick={handleGrade}>
              {loading ? "批改中…" : "送出批改"}
            </button>
            {error && (
              <p className="error" style={{ whiteSpace: "pre-wrap" }}>
                {error}
              </p>
            )}
          </section>

          <section className="graded">
            {!result && !loading && (
              <div className="empty">
                <p>批改結果會顯示在這裡，送出後會自動存入歷史紀錄。</p>
              </div>
            )}
            {loading && (
              <div className="empty">
                <p>{statusMessage || "閱卷委員審閱中…"}</p>
              </div>
            )}
            {result && (
              <>
                <div className="score-block">
                  <span className="score-label">估計分數</span>
                  <span className="score-number">{result.overall_score}</span>
                </div>

                <div className="dimensions">
                  {result.dimensions.map((d, i) => (
                    <div className="dim-row" key={i}>
                      <div className="dim-top">
                        <span className="dim-name">{d.name}</span>
                        <span className="dim-score">{d.score}/10</span>
                      </div>
                      <div className="dim-bar">
                        <div
                          className="dim-bar-fill"
                          style={{ width: `${(d.score / 10) * 100}%` }}
                        />
                      </div>
                      <p className="dim-comment">{d.comment}</p>
                    </div>
                  ))}
                </div>

                <div className="notes">
                  <h3 className="notes-title">段落評註</h3>
                  {result.paragraph_notes.map((n, i) => (
                    <div className="note" key={i}>
                      <p className="note-excerpt">「{n.excerpt}」</p>
                      <p className="note-comment">{n.comment}</p>
                      <p className="note-suggestion">改寫建議：{n.suggestion}</p>
                    </div>
                  ))}
                </div>

                <div className="summary">
                  <h3 className="notes-title">總結建議</h3>
                  <p>{result.summary}</p>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "history" && (
        <div className="history-wrap">
          {historyError && <p className="error">{historyError}</p>}

          {trends.length > 0 && (
            <section className="sheet trend-block">
              <h3 className="notes-title">各科目平均分數</h3>
              {trends.map((t) => (
                <div className="dim-row" key={t.subject}>
                  <div className="dim-top">
                    <span className="dim-name">
                      {t.subject}（{t.count} 次）
                    </span>
                    <span className="dim-score">{t.average.toFixed(1)}</span>
                  </div>
                  <div className="dim-bar">
                    <div
                      className="dim-bar-fill"
                      style={{ width: `${Math.min(t.average, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </section>
          )}

          {weakDims.length > 0 && (
            <section className="sheet trend-block">
              <h3 className="notes-title">弱點分析（由弱到強）</h3>
              {weakDims.map((d) => (
                <div className="dim-row" key={d.name}>
                  <div className="dim-top">
                    <span className="dim-name">
                      {d.name}（{d.count} 次）
                    </span>
                    <span className="dim-score">{d.average.toFixed(1)}/10</span>
                  </div>
                  <div className="dim-bar">
                    <div
                      className="dim-bar-fill"
                      style={{ width: `${(d.average / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="sheet">
            {historyLoading && <p className="empty">載入中…</p>}
            {!historyLoading && history.length === 0 && (
              <p className="empty">還沒有批改紀錄。</p>
            )}
            {history.map((r) => (
              <div className="history-item" key={r.id}>
                <div className="history-top">
                  <span className="history-subject">{r.subject}</span>
                  {r.reference_material && <span className="history-ref-tag">有參考資料</span>}
                  <span className="history-date">
                    {new Date(r.created_at).toLocaleString("zh-TW")}
                  </span>
                  <span className="history-score">{r.overall_score}</span>
                </div>
                <p className="history-question">{r.question}</p>
                {r.summary && <p className="history-summary">{r.summary}</p>}
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
