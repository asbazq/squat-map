import { REGIONS } from "./records";

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date) {
  return `${date.getMonth() + 1}월`;
}

function getRecordsInWindow(records, start, end) {
  return records.filter((record) => {
    const time = new Date(record.createdAt).getTime();
    return time >= start && time < end;
  });
}

export function buildDashboardMetrics(records, rankings, selectedRegion, reviewQueueCount) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const thisWindow = getRecordsInWindow(records, now - 30 * day, now).length;
  const prevWindow = getRecordsInWindow(records, now - 60 * day, now - 30 * day).length;
  const windowDelta = prevWindow === 0 ? (thisWindow > 0 ? 100 : 0) : Math.round(((thisWindow - prevWindow) / prevWindow) * 100);

  const activeRegions = new Set(records.map((record) => record.region)).size;
  const regionalRecords = records.filter((record) => record.region === selectedRegion);
  const regionalAverage = regionalRecords.length
    ? (regionalRecords.reduce((sum, record) => sum + record.recordKg, 0) / regionalRecords.length).toFixed(1)
    : "0.0";
  const nationalLeader = rankings.national[0];

  return [
    {
      label: "Total Records",
      value: records.length.toLocaleString("ko-KR"),
      detail: "누적 인증 기록",
      change: `${windowDelta >= 0 ? "+" : ""}${windowDelta}%`,
      tone: windowDelta >= 0 ? "up" : "down",
    },
    {
      label: "National Best",
      value: nationalLeader ? `${nationalLeader.recordKg}kg` : "-",
      detail: nationalLeader ? `${nationalLeader.nickname} · ${nationalLeader.region}` : "기록 없음",
      change: "TOP 1",
      tone: "neutral",
    },
    {
      label: "Active Regions",
      value: `${activeRegions}/${REGIONS.length}`,
      detail: "기록이 존재하는 지역",
      change: `${Math.round((activeRegions / REGIONS.length) * 100) || 0}%`,
      tone: "up",
    },
    {
      label: `${selectedRegion} Avg`,
      value: `${regionalAverage}kg`,
      detail: `${selectedRegion} 평균 기록`,
      change: `${regionalRecords.length} records`,
      tone: "neutral",
    },
    {
      label: "Review Queue",
      value: reviewQueueCount.toLocaleString("ko-KR"),
      detail: "관리자 검수 대기",
      change: reviewQueueCount > 0 ? "Check now" : "Stable",
      tone: reviewQueueCount > 0 ? "warn" : "up",
    },
  ];
}

export function buildMonthlyTrend(records, count = 6) {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = getMonthKey(date);
    months.push({
      key,
      label: getMonthLabel(date),
      count: 0,
      volume: 0,
    });
  }

  const monthMap = new Map(months.map((month) => [month.key, month]));
  records.forEach((record) => {
    const date = new Date(record.createdAt);
    const month = monthMap.get(getMonthKey(date));
    if (!month) return;
    month.count += 1;
    month.volume += record.recordKg;
  });

  return months.map((month) => ({
    ...month,
    average: month.count ? month.volume / month.count : 0,
  }));
}

export function buildRegionDistribution(records) {
  return REGIONS.map((region) => {
    const regionRecords = records.filter((record) => record.region === region);
    const leader = [...regionRecords].sort((a, b) => b.recordKg - a.recordKg)[0] ?? null;
    return {
      region,
      count: regionRecords.length,
      average: regionRecords.length
        ? regionRecords.reduce((sum, record) => sum + record.recordKg, 0) / regionRecords.length
        : 0,
      leader,
    };
  })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

export function buildDashboardInsights(records, rankings, selectedRegion) {
  const recentRecords = [...records]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);
  const selectedLeader = rankings.byRegion[selectedRegion]?.[0] ?? null;
  const topNotes = rankings.national
    .filter((record) => record.notes)
    .slice(0, 3);

  return {
    recentRecords,
    selectedLeader,
    topNotes,
  };
}
