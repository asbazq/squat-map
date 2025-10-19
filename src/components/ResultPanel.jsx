export default function ResultPanel({ result }) {
  if (!result) return <pre>Ready.</pre>;
  const color = result.summary==="PASS" ? "green" :
                result.summary==="FAIL" ? "red" : "orange";
  return (
    <pre style={{color}}>
{`SUMMARY: ${result.summary}
PASS: ${result.pass} | FAIL: ${result.fail}
TH: ${result.threshold} | HOLD: ${result.hold}
max depth_ratio: ${result.depthRatioMax?.toFixed?.(2) ?? '-'}
`}
    </pre>
  );
}
