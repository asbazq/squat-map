import { REGIONS } from "../lib/records";

function RankingList({ title, items, emptyLabel, showNotesTopFive = false }) {
  return (
    <div className="ranking-column">
      <div className="ranking-title">
        <h3>{title}</h3>
      </div>
      <div className="ranking-body">
        {items.length ? (
          <ol className="ranking-list">
            {items.map((item, index) => (
              <li key={item.id} className="ranking-item">
                <span className="rank-index">{index + 1}</span>
                <div className="rank-copy">
                  <strong>{item.nickname}</strong>
                  <span>{item.region}</span>
                  {showNotesTopFive && index < 5 && item.notes ? <p className="rank-note">{item.notes}</p> : null}
                </div>
                <strong className="rank-value">{item.recordKg}kg</strong>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-panel">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

export default function RankingBoard({ rankings, selectedRegion, onSelectRegion }) {
  const regional = rankings.byRegion[selectedRegion] ?? [];

  return (
    <div className="ranking-board">
      <div className="region-select-wrap">
        <label className="region-select-label" htmlFor="rankingRegion">
          지역 선택
        </label>
        <select id="rankingRegion" className="region-select" value={selectedRegion} onChange={(event) => onSelectRegion(event.target.value)}>
          {REGIONS.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </div>

      <div className="ranking-grid">
        <RankingList title={`${selectedRegion} 순위`} items={regional} emptyLabel="이 지역에는 아직 인증 기록이 없습니다." />
        <RankingList title="전국 순위" items={rankings.national} emptyLabel="전국 인증 기록이 아직 없습니다." showNotesTopFive />
      </div>
    </div>
  );
}
