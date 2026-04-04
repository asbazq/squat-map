import { useEffect, useMemo, useState } from "react";
import "./app.css";
import VideoInput from "./components/VideoInput";
import RecordForm from "./components/RecordForm";
import RankingBoard from "./components/RankingBoard";
import RegionMap from "./components/RegionMap";
import AdminPanel from "./components/AdminPanel";
import {
  enqueueReviewRecords,
  isAdminAuthenticated,
  loadReviewQueue,
  loginAdmin,
  logoutAdmin,
  removeReviewRecord,
} from "./lib/admin";
import {
  DEFAULT_REGION,
  REGIONS,
  buildSubmissionFromAnalysis,
  computeRegionLeaders,
  computeRankings,
  deleteRecord,
  loadRecords,
  saveRecord,
} from "./lib/records";
import { deleteVideo, saveVideo } from "./lib/videoStore";

function getNationalTopFiveIds(records) {
  return computeRankings(records).national.slice(0, 5).map((record) => record.id);
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [latestResult, setLatestResult] = useState(null);
  const [pendingSubmission, setPendingSubmission] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(DEFAULT_REGION);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [adminLoginError, setAdminLoginError] = useState("");
  const [isAdminButtonVisible, setIsAdminButtonVisible] = useState(false);
  const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);

  useEffect(() => {
    setRecords(loadRecords());
    setIsAdminOpen(isAdminAuthenticated());
    setReviewQueue(loadReviewQueue());
  }, []);

  const rankings = useMemo(() => computeRankings(records), [records]);
  const regionLeaders = useMemo(() => computeRegionLeaders(records), [records]);

  function handleAnalysisComplete(result, videoFile) {
    setLatestResult(result);
    setPendingSubmission({
      ...buildSubmissionFromAnalysis(result),
      videoFile: result?.summary === "PASS" ? videoFile ?? null : null,
    });
  }

  async function handleSaveRecord(formData) {
    if (!pendingSubmission?.canSubmit) return;
    const previousTopFive = getNationalTopFiveIds(records);

    const saved = saveRecord({
      ...formData,
      verification: pendingSubmission.verification,
    });
    const nextRecords = [saved, ...records];

    const nextTopFive = getNationalTopFiveIds(nextRecords);
    const enteredTopFive = nextTopFive.filter((id) => !previousTopFive.includes(id));
    if (enteredTopFive.length) {
      if (enteredTopFive.includes(saved.id) && pendingSubmission.videoFile) {
        await saveVideo(saved.id, pendingSubmission.videoFile);
      }
      setReviewQueue(enqueueReviewRecords(enteredTopFive));
    }

    setRecords(nextRecords);
    setSelectedRegion(saved.region);
    setPendingSubmission({
      ...pendingSubmission,
      canSubmit: false,
      savedId: saved.id,
      videoFile: null,
    });
  }

  function handleAdminLogin(password) {
    const ok = loginAdmin(password);
    setIsAdminOpen(ok);
    setAdminLoginError(ok ? "" : "관리자 비밀번호가 올바르지 않습니다.");
  }

  function handleAdminLogout() {
    logoutAdmin();
    setIsAdminOpen(false);
  }

  async function handleApproveRecord(recordId) {
    await deleteVideo(recordId);
    setReviewQueue(removeReviewRecord(recordId));
  }

  async function handleDeleteManagedRecord(recordId) {
    const nextRecords = deleteRecord(recordId);
    await deleteVideo(recordId);
    setRecords(nextRecords);
    setReviewQueue(removeReviewRecord(recordId));
  }

  function handleAdminBadgeClick() {
    setIsAdminButtonVisible(true);
  }

  return (
    <main className="app-shell">
      <section className="hero-card hero-swap">
        <div className="hero-copy">
          <div className="hero-topbar">
            {isAdminButtonVisible ? (
              <button type="button" className="admin-inline-btn" onClick={() => setIsAdminModalVisible(true)}>
                관리자 공간
              </button>
            ) : (
              <button type="button" className="eyebrow eyebrow-swipe" onClick={handleAdminBadgeClick}>
                Squat Map
              </button>
            )}
          </div>
          <h1>스쿼트 지도</h1>
          <p>
            사용자가 영상을 올리면 브라우저에서 스쿼트 깊이를 판별합니다.
            <strong> 풀스쿼트 PASS</strong>가 나오면 위치와 기록을 직접 입력해 저장하고,
            저장된 결과는 지역별 순위와 전국 순위로 집계됩니다.
          </p>
        </div>

        <div className="hero-meta" aria-label="서비스 요약 통계">
          <span><strong>{records.length}</strong> 인증 기록</span>
          <span><strong>{rankings.national.length}</strong> 전국 랭커</span>
          <span><strong>{regionLeaders.length}</strong> 지역 리더</span>
        </div>
      </section>

      <section className="content-grid">
        <div className="stack">
          <section className="surface-card">
            <div className="section-head">
              <div><span className="section-kicker">1. 영상 인증</span><h2>풀스쿼트 판별</h2></div>
              <p>측면 영상일수록 판별 정확도가 높습니다.</p>
            </div>
            <VideoInput onAnalysisComplete={handleAnalysisComplete} />
          </section>

          <section className="surface-card">
            <div className="section-head">
              <div><span className="section-kicker">2. 기록 등록</span><h2>통과한 기록만 저장</h2></div>
              <p>사용자가 직접 기록만 입력하고 위치는 자동으로 지역 판정에 반영합니다.</p>
            </div>
            <RecordForm pendingSubmission={pendingSubmission} latestResult={latestResult} onSave={handleSaveRecord} />
          </section>
        </div>

        <div className="stack">
          <section className="surface-card">
            <div className="section-head">
              <div><span className="section-kicker">3. 지역 지도</span><h2>기록 분포</h2></div>
              <p>지역을 눌러 해당 지역 순위를 바로 확인할 수 있습니다.</p>
            </div>
            <RegionMap records={records} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />
          </section>

          <section className="surface-card">
            <div className="section-head">
              <div><span className="section-kicker">4. 랭킹</span><h2>지역별 / 전국 순위</h2></div>
              <p>{REGIONS.includes(selectedRegion) ? `${selectedRegion} 기준` : "전국 기준"}으로 정렬합니다.</p>
            </div>
            <RankingBoard rankings={rankings} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />
          </section>
        </div>
      </section>

      {isAdminModalVisible ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setIsAdminModalVisible(false)}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-label="관리자 공간" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-head">
              <div>
                <span className="section-kicker">관리자 전용</span>
                <h2>관리자 공간</h2>
              </div>
              <button type="button" className="secondary-btn" onClick={() => setIsAdminModalVisible(false)}>
                닫기
              </button>
            </div>
            <AdminPanel
              isAuthenticated={isAdminOpen}
              loginError={adminLoginError}
              reviewQueue={reviewQueue}
              records={records}
              onLogin={handleAdminLogin}
              onLogout={handleAdminLogout}
              onApproveRecord={handleApproveRecord}
              onRejectRecord={handleDeleteManagedRecord}
              onDeleteRecord={handleDeleteManagedRecord}
            />
          </section>
        </div>
      ) : null}
    </main>
  );
}