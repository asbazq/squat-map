import { TH } from "../config";

function getResultTone(summary) {
  if (summary === "PASS") return "pass";
  if (summary === "FAIL") return "fail";
  return "mixed";
}

function getResultHeadline(result) {
  if (!result) return "분석 대기 중";
  if (result.summary === "PASS") return "풀스쿼트 기준을 통과했습니다";
  if (result.summary === "FAIL") return "깊이가 기준에 미치지 못했습니다";
  if (result.summary === "MIXED") return "반복마다 깊이 편차가 있었습니다";
  return "트래킹이 불안정해 다시 촬영하는 편이 좋습니다";
}

function getDepthMessage(depthRatioMax) {
  if (!Number.isFinite(depthRatioMax)) return "깊이 수치를 안정적으로 읽지 못했습니다.";
  if (depthRatioMax >= TH + 0.1) return "엉덩이가 무릎 라인 아래로 여유 있게 내려갔습니다.";
  if (depthRatioMax >= TH) return "기준선은 넘겼지만 여유가 아주 크지는 않았습니다.";
  if (depthRatioMax >= TH - 0.1) return "풀스쿼트에 가깝지만 기준에는 조금 부족했습니다.";
  return "측정 결과는 하프 스쿼트에 더 가까웠습니다.";
}

function getConsistencyMessage(result) {
  if (!result) return "";
  const repCount = result.reps?.length ?? 0;
  if (!repCount) return "명확한 반복이 감지되지 않았습니다. 측면 구도를 더 분명하게 잡아보세요.";
  if (result.pass > 0 && result.fail === 0 && result.unsure === 0) return `감지된 ${repCount}회가 모두 안정적으로 통과했습니다.`;
  if (result.pass > 0 && result.fail > 0) return `감지된 ${repCount}회 중 일부만 통과했습니다. 반복별 깊이 차이가 있었습니다.`;
  if (result.unsure > 0) return `감지된 ${repCount}회 중 일부는 트래킹 품질 때문에 판정이 불안정했습니다.`;
  return `감지된 ${repCount}회 모두 현재 기준값 아래에 머물렀습니다.`;
}

function buildResultInsights(result) {
  if (!result) return null;
  const repCount = result.reps?.length ?? 0;
  return {
    tone: getResultTone(result.summary),
    headline: getResultHeadline(result),
    body: `${getDepthMessage(result.depthRatioMax)} ${getConsistencyMessage(result)}`.trim(),
    stats: [
      {
        label: "판정 결과",
        value: result.summary,
      },
      {
        label: "최대 깊이",
        value: Number.isFinite(result.depthRatioMax) ? result.depthRatioMax.toFixed(2) : "-",
      },
      {
        label: "감지 반복",
        value: `${repCount}`,
      },
      {
        label: "하단 유지",
        value: `${result.hold}f`,
      },
    ],
    reps: (result.reps ?? []).map((rep) => ({
      ...rep,
      description:
        rep.status === "PASS"
          ? `최저점 ${rep.peak.toFixed(2)}로 기준을 넘겼고 ${rep.hold}프레임 유지했습니다.`
          : rep.status === "FAIL"
            ? `최저점 ${rep.peak.toFixed(2)}까지 내려갔지만 기준 통과에는 부족했습니다.`
            : `최저점 ${rep.peak.toFixed(2)}가 감지됐지만 반복 판정은 불안정했습니다.`,
    })),
  };
}

export default function AnalysisSummary({ result }) {
  const insights = buildResultInsights(result);
  const resultClassName = result?.summary === "PASS" ? "video-result pass" : result?.summary === "FAIL" ? "video-result fail" : "video-result";
  const visibleReps = insights?.reps?.slice(0, 3) ?? [];
  const hiddenRepCount = Math.max(0, (insights?.reps?.length ?? 0) - visibleReps.length);

  return (
    <section className={resultClassName}>
      {insights ? (
        <div className="result-panel">
          <div className="result-hero">
            <span className={`result-badge ${insights.tone}`}>{result.summary}</span>
            <div>
              <h3>{insights.headline}</h3>
              <p>{insights.body}</p>
            </div>
          </div>

          <div className="result-stats">
            {insights.stats.map((stat) => (
              <article key={stat.label} className="result-stat-card">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>

          <div className="result-reps">
            <div className="result-subhead">
              <h4>반복별 해석</h4>
              <span>{result.reps?.length ? `${result.reps.length}회 감지` : "반복 감지 없음"}</span>
            </div>
            {visibleReps.length ? (
              <ol className="result-rep-list">
                {visibleReps.map((rep) => (
                  <li key={rep.index} className="result-rep-item">
                    <div className="result-rep-head">
                      <strong>REP {rep.index}</strong>
                      <span className={`result-chip ${getResultTone(rep.status)}`}>{rep.status}</span>
                    </div>
                    <p>{rep.description}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty-panel">안정적으로 감지된 반복이 아직 없습니다. 측면 구도를 다시 맞춰 촬영해 보세요.</div>
            )}
            {hiddenRepCount ? <p className="result-overflow-note">추가 {hiddenRepCount}회는 감지 반복 지표에 요약되어 있습니다.</p> : null}
          </div>
        </div>
      ) : (
        <div className="result-empty">
          <strong>분석 결과 대기 중</strong>
          <p>영상 분석이 끝나면 스쿼트 판정, 최대 깊이, 반복별 해석이 이 영역에 표시됩니다.</p>
        </div>
      )}
    </section>
  );
}
