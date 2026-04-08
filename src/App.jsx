import { useCallback, useEffect, useMemo, useState } from "react";
import "./app.css";
import VideoInput from "./components/VideoInput";
import RecordForm from "./components/RecordForm";
import RankingBoard from "./components/RankingBoard";
import RegionMap from "./components/RegionMap";
import AdminPanel from "./components/AdminPanel";
import DashboardOverview from "./components/DashboardOverview";
import AnalysisSummary from "./components/AnalysisSummary";
import {
  approveReviewRecord,
  fetchReviewQueue,
  getAdminSession,
  isAdminAuthenticated,
  loginAdmin,
  rejectReviewRecord,
  logoutAdmin,
} from "./lib/adminApi";
import {
  DEFAULT_REGION,
  REGIONS,
  buildSubmissionFromAnalysis,
  computeRegionLeaders,
  computeRankings,
} from "./lib/records";
import { createRecord, fetchRecords, removeRecord, uploadReviewVideo } from "./lib/recordApi";

export default function App() {
  const [records, setRecords] = useState([]);
  const [latestResult, setLatestResult] = useState(null);
  const [pendingSubmission, setPendingSubmission] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(DEFAULT_REGION);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [adminLoginError, setAdminLoginError] = useState("");
  const [adminActionError, setAdminActionError] = useState("");
  const [isAdminButtonVisible, setIsAdminButtonVisible] = useState(false);
  const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);
  const [videoControls, setVideoControls] = useState(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const nextRecords = await fetchRecords();
        if (active) setRecords(nextRecords);
      } catch {
        if (active) setRecords([]);
      }

      if (!isAdminAuthenticated()) return;

      try {
        const nextQueue = await fetchReviewQueue();
        if (active) setReviewQueue(nextQueue);
      } catch {
        if (active) setReviewQueue([]);
      }
    })();

    setIsAdminOpen(isAdminAuthenticated());

    return () => {
      active = false;
    };
  }, []);

  const rankings = useMemo(() => computeRankings(records), [records]);
  const regionLeaders = useMemo(() => computeRegionLeaders(records), [records]);

  const handleVideoControlsChange = useCallback((nextControls) => {
    setVideoControls((prev) => {
      if (
        prev &&
        prev.hasVideo === nextControls.hasVideo &&
        prev.fileLabel === nextControls.fileLabel &&
        prev.isExporting === nextControls.isExporting &&
        prev.isFaceMosaic === nextControls.isFaceMosaic &&
        prev.openFilePicker === nextControls.openFilePicker &&
        prev.toggleFaceMosaic === nextControls.toggleFaceMosaic &&
        prev.exportSkeletonVideo === nextControls.exportSkeletonVideo
      ) {
        return prev;
      }
      return nextControls;
    });
  }, []);

  function handleAnalysisComplete(result, videoFile) {
    const submission = buildSubmissionFromAnalysis(result);
    setLatestResult(result);
    setPendingSubmission({
      ...submission,
      videoFile: submission?.canSubmit ? videoFile ?? null : null,
    });
  }

  async function handleSaveRecord(formData) {
    if (!pendingSubmission?.canSubmit) return;
    setAdminActionError("");

    const saved = await createRecord({
      ...formData,
      verification: pendingSubmission.verification,
    });
    const nextRecords = [saved, ...records];

    if (saved.requiresReviewVideoUpload && pendingSubmission.videoFile) {
      await uploadReviewVideo(saved.id, pendingSubmission.videoFile);
      if (isAdminAuthenticated()) {
        setReviewQueue(await fetchReviewQueue());
      } else {
        setReviewQueue((prev) => {
          if (prev.some((item) => item.recordId === saved.id)) return prev;
          return [{ recordId: saved.id, reviewVideoUrl: null }, ...prev];
        });
      }
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

  async function handleAdminLogin(username, password) {
    try {
      const ok = await loginAdmin(username, password);
      setIsAdminOpen(ok);
      if (ok) {
        setReviewQueue(await fetchReviewQueue({ username, password }));
      }
      setAdminLoginError(ok ? "" : "관리자 아이디 또는 비밀번호가 올바르지 않습니다.");
    } catch {
      setIsAdminOpen(false);
      setReviewQueue([]);
      setAdminLoginError("관리자 로그인 요청에 실패했습니다.");
    }
  }

  function handleAdminLogout() {
    logoutAdmin();
    setIsAdminOpen(false);
    setReviewQueue([]);
  }

  async function handleApproveRecord(recordId) {
    setReviewQueue(await approveReviewRecord(recordId, getAdminSession()));
  }

  async function handleDeleteManagedRecord(recordId) {
    await removeRecord(recordId, getAdminSession());
    const nextRecords = records.filter((record) => record.id !== recordId);
    setRecords(nextRecords);
    setReviewQueue((prev) => prev.filter((item) => item.recordId !== recordId));
  }

  async function handleApproveRecordWithError(recordId) {
    try {
      setAdminActionError("");
      setReviewQueue(await approveReviewRecord(recordId, getAdminSession()));
    } catch (error) {
      setAdminActionError(error.message || "검수 승인에 실패했습니다.");
    }
  }

  async function handleRejectRecordWithError(recordId) {
    try {
      setAdminActionError("");
      setReviewQueue(await rejectReviewRecord(recordId, getAdminSession()));
      setRecords((prev) => prev.filter((record) => record.id !== recordId));
    } catch (error) {
      setAdminActionError(error.message || "검수 반려에 실패했습니다.");
    }
  }

  async function handleDeleteManagedRecordWithError(recordId) {
    try {
      setAdminActionError("");
      await handleDeleteManagedRecord(recordId);
    } catch (error) {
      setAdminActionError(error.message || "기록 삭제에 실패했습니다.");
    }
  }

  function handleAdminBadgeClick() {
    setIsAdminButtonVisible(true);
  }

  return (
    <main className="app-shell executive-shell">
      <section className="hero-card dashboard-header-card">
        <div className="dashboard-header-copy">
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
          <h1>Squat Performance Dashboard</h1>
          <p>
            영상 기반 풀스쿼트 판별, 지역 지도, 랭킹, 관리자 검수 흐름을 한 화면에서 관리하는 운영 대시보드입니다.
          </p>
        </div>

        <div className="hero-meta" aria-label="서비스 요약 통계">
          <span><strong>{records.length}</strong> Total Records</span>
          <span><strong>{rankings.national.length}</strong> National Ranked</span>
          <span><strong>{regionLeaders.length}</strong> Active Leaders</span>
          <span><strong>{reviewQueue.length}</strong> Review Queue</span>
        </div>
      </section>

      <DashboardOverview
        records={records}
        rankings={rankings}
        selectedRegion={selectedRegion}
        reviewQueueCount={reviewQueue.length}
      />

      <section className="dashboard-core-grid">
        <section className="surface-card dashboard-map-card">
          <div className="section-head section-head-balanced">
            <div>
              <span className="section-kicker">Main Visualization</span>
              <h2>지역 분포 맵</h2>
            </div>
            <p>{REGIONS.includes(selectedRegion) ? `${selectedRegion} 기준으로 지도와 최근 등록 기록을 동기화합니다.` : "지역을 선택하면 지도와 랭킹이 함께 바뀝니다."}</p>
          </div>
          <RegionMap records={records} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />
        </section>

        <section className="surface-card dashboard-ranking-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">Ranking Snapshot</span>
              <h2>지역별 / 전국 순위</h2>
            </div>
            <p>선택한 지역 순위와 전국 상위권을 같은 톤으로 비교합니다.</p>
          </div>
          <RankingBoard rankings={rankings} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />
        </section>
      </section>

      <section className="operations-grid">
        <section className="surface-card video-ops-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">Video Certification</span>
              <h2>풀스쿼트 영상 인증</h2>
            </div>
            <div className="section-head-side section-head-side-balanced">
              <p>측면 촬영 영상을 업로드하면 브라우저에서 바로 스켈레톤과 깊이 분석을 수행합니다.</p>
              <div className="section-head-actions">
                <button type="button" className="btn-upload" onClick={() => videoControls?.openFilePicker?.()}>
                  영상 선택
                </button>
                <button
                  type="button"
                  className="btn-upload"
                  onClick={() => videoControls?.exportSkeletonVideo?.()}
                  disabled={!videoControls?.hasVideo || videoControls?.isExporting}
                >
                  {videoControls?.isExporting ? "생성 중..." : "스켈레톤 다운로드"}
                </button>
                <button type="button" className="secondary-btn" onClick={() => videoControls?.toggleFaceMosaic?.()}>
                  {videoControls?.isFaceMosaic ? "얼굴 모자이크 ON" : "얼굴 모자이크 OFF"}
                </button>
              </div>
            </div>
          </div>
          <VideoInput onAnalysisComplete={handleAnalysisComplete} onControlsChange={handleVideoControlsChange} />
        </section>

        <div className="operations-side-stack">
          <section className="surface-card record-ops-card">
            <div className="section-head section-head-balanced">
              <div>
                <span className="section-kicker">Record Entry</span>
                <h2>통과 기록 저장</h2>
              </div>
              <p>PASS 판정이 난 경우에만 지역과 기록을 저장할 수 있습니다.</p>
            </div>
            <RecordForm pendingSubmission={pendingSubmission} latestResult={latestResult} onSave={handleSaveRecord} />
          </section>

          <section className="surface-card analysis-ops-card">
            <div className="section-head section-head-balanced">
              <div>
                <span className="section-kicker">Analysis Result</span>
                <h2>분석 결과 요약</h2>
              </div>
              <p>인증 후 생성되는 스쿼트 깊이, 반복 해석, 통과 여부를 여기서 확인할 수 있습니다.</p>
            </div>
            <AnalysisSummary result={latestResult} />
          </section>
        </div>
      </section>

      {isAdminModalVisible ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setIsAdminModalVisible(false)}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-label="관리자 공간" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-head">
              <div>
                <span className="section-kicker">Admin Console</span>
                <h2>관리자 공간</h2>
              </div>
              <button type="button" className="secondary-btn" onClick={() => setIsAdminModalVisible(false)}>
                닫기
              </button>
            </div>
            <AdminPanel
              isAuthenticated={isAdminOpen}
              loginError={adminLoginError}
              actionError={adminActionError}
              reviewQueue={reviewQueue}
              records={records}
              onLogin={handleAdminLogin}
              onLogout={handleAdminLogout}
              onApproveRecord={handleApproveRecordWithError}
              onRejectRecord={handleRejectRecordWithError}
              onDeleteRecord={handleDeleteManagedRecordWithError}
            />
          </section>
        </div>
      ) : null}
    </main>
  );
}
