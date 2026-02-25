export default function ResultPanel({ result }) {
  // 아직 분석이 끝나지 않았으면 기본 상태 문구만 표시
  if (!result) return <pre>Ready.</pre>;
  // 요약 결과에 따라 색상을 고정해 상태를 빠르게 구분
  const color = result.summary==="PASS" ? "green" :
                result.summary==="FAIL" ? "red" : "orange";
  return (
    <pre style={{color}}>
{/* 사람이 읽기 쉬운 텍스트 리포트 형식으로 그대로 출력 */}
{`SUMMARY: ${result.summary}
PASS: ${result.pass} | FAIL: ${result.fail} | UNSURE: ${result.unsure ?? 0}
TH: ${result.threshold} | HOLD: ${result.hold}
max depth_ratio: ${result.depthRatioMax?.toFixed?.(2) ?? '-'}
${result.reps?.length ? `\n${result.reps.map((r) => `REP ${r.index}: ${r.status} (peak=${r.peak.toFixed(2)}, hold=${r.hold})`).join("\n")}` : "\nREP: none"}
`}
    </pre>
  );
}
