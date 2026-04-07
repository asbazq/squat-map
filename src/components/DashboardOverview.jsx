import {
  buildDashboardInsights,
  buildDashboardMetrics,
  buildMonthlyTrend,
  buildRegionDistribution,
} from "../lib/dashboard";

function formatCompactNumber(value) {
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function MetricCard({ metric }) {
  return (
    <article className="metric-card">
      <div className="metric-head">
        <span>{metric.label}</span>
        <span className={`metric-change ${metric.tone}`}>{metric.change}</span>
      </div>
      <strong>{metric.value}</strong>
      <p>{metric.detail}</p>
    </article>
  );
}

function buildLinePath(values, width, height, padding) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const min = 0;
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = padding + step * index;
      const y = height - padding - ((value - min) / (max - min || 1)) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function TrendCard({ series }) {
  const width = 520;
  const height = 240;
  const padding = 18;
  const countPath = buildLinePath(series.map((item) => item.count), width, height, padding);
  const avgPath = buildLinePath(series.map((item) => item.average), width, height, padding);

  return (
    <div className="dashboard-chart-card">
      <div className="dashboard-card-head">
        <div>
          <span className="dashboard-card-kicker">Monthly Trend</span>
          <h3>월별 인증 추이</h3>
        </div>
        <p>최근 6개월 동안의 인증 수와 평균 기록 변화를 같이 봅니다.</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="dashboard-line-chart" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={padding}
            x2={width - padding}
            y1={padding + (height - padding * 2) * ratio}
            y2={padding + (height - padding * 2) * ratio}
          />
        ))}
        <path d={countPath} className="line-primary" />
        <path d={avgPath} className="line-secondary" />
      </svg>
      <div className="chart-legend">
        <span><i className="legend-dot primary" /> 인증 수</span>
        <span><i className="legend-dot secondary" /> 평균 기록</span>
      </div>
      <div className="chart-axis">
        {series.map((item) => (
          <span key={item.key}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function ComparisonCard({ items }) {
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="dashboard-chart-card">
      <div className="dashboard-card-head">
        <div>
          <span className="dashboard-card-kicker">Regional Mix</span>
          <h3>지역별 기록 비중</h3>
        </div>
        <p>기록이 많이 쌓인 지역과 평균 중량을 함께 확인합니다.</p>
      </div>
      <div className="comparison-list">
        {items.map((item) => (
          <div key={item.region} className="comparison-row">
            <div className="comparison-copy">
              <strong>{item.region}</strong>
              <span>{item.leader ? `지역 1위 ${item.leader.recordKg}kg` : "기록 없음"}</span>
            </div>
            <div className="comparison-bar-track">
              <div className="comparison-bar" style={{ width: `${(item.count / maxCount) * 100}%` }} />
            </div>
            <strong className="comparison-value">{item.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightCard({ title, kicker, children }) {
  return (
    <article className="dashboard-insight-card">
      <span className="dashboard-card-kicker">{kicker}</span>
      <h3>{title}</h3>
      {children}
    </article>
  );
}

export default function DashboardOverview({ records, rankings, selectedRegion, reviewQueueCount }) {
  const metrics = buildDashboardMetrics(records, rankings, selectedRegion, reviewQueueCount);
  const trend = buildMonthlyTrend(records);
  const regionDistribution = buildRegionDistribution(records);
  const insights = buildDashboardInsights(records, rankings, selectedRegion);

  return (
    <>
      <section className="metric-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="dashboard-main-grid">
        <TrendCard series={trend} />

        <div className="dashboard-chart-card dashboard-side-card">
          <div className="dashboard-card-head">
            <div>
              <span className="dashboard-card-kicker">Overview</span>
              <h3>핵심 운영 상태</h3>
            </div>
            <p>현재 선택 지역과 전국 상위권의 상태를 빠르게 확인합니다.</p>
          </div>
          <div className="snapshot-list">
            <div className="snapshot-row">
              <span>선택 지역</span>
              <strong>{selectedRegion}</strong>
            </div>
            <div className="snapshot-row">
              <span>지역 1위</span>
              <strong>{insights.selectedLeader ? `${insights.selectedLeader.nickname} · ${insights.selectedLeader.recordKg}kg` : "기록 없음"}</strong>
            </div>
            <div className="snapshot-row">
              <span>전국 TOP 3</span>
              <strong>{rankings.national.slice(0, 3).map((item) => item.nickname).join(", ") || "기록 없음"}</strong>
            </div>
            <div className="snapshot-row">
              <span>검수 대기</span>
              <strong>{reviewQueueCount}건</strong>
            </div>
          </div>
        </div>

        <ComparisonCard items={regionDistribution} />
      </section>

      <section className="dashboard-insight-grid">
        <InsightCard title="최근 등록" kicker="Activity">
          <ul className="dashboard-mini-list">
            {insights.recentRecords.length ? insights.recentRecords.map((record) => (
              <li key={record.id}>
                <strong>{record.nickname}</strong>
                <span>{record.region} · {record.recordKg}kg</span>
              </li>
            )) : <li><span>아직 등록된 기록이 없습니다.</span></li>}
          </ul>
        </InsightCard>

        <InsightCard title="운영 임계값" kicker="Policy">
          <div className="policy-grid">
            <div>
              <span>판정 기준</span>
              <strong>1.05</strong>
            </div>
            <div>
              <span>하단 유지</span>
              <strong>2 프레임</strong>
            </div>
            <div>
              <span>위치 저장</span>
              <strong>지역 단위</strong>
            </div>
          </div>
        </InsightCard>

        <InsightCard title="상위권 메모" kicker="Notes">
          <ul className="dashboard-mini-list">
            {insights.topNotes.length ? insights.topNotes.map((record) => (
              <li key={record.id}>
                <strong>{record.nickname}</strong>
                <span>{record.notes}</span>
              </li>
            )) : <li><span>상위권 메모가 아직 없습니다.</span></li>}
          </ul>
        </InsightCard>
      </section>
    </>
  );
}
