import { useEffect, useMemo, useState } from "react";
import { getVideo } from "../lib/videoStore";
import { REGIONS } from "../lib/records";

const TEXT = {
  loginDesc: "\uad00\ub9ac\uc790\ub9cc \uc811\uadfc\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4. \uc804\uad6d \uc21c\uc704 5\uc704\uad8c \ubcc0\ub3d9 \uc601\uc0c1\uc740 \uc774 \uacf5\uac04\uc5d0\uc11c\ub9cc \uac80\uc218\ub429\ub2c8\ub2e4.",
  password: "\uad00\ub9ac\uc790 \ube44\ubc00\ubc88\ud638",
  passwordPlaceholder: "\ube44\ubc00\ubc88\ud638 \uc785\ub825",
  login: "\uad00\ub9ac\uc790 \ub85c\uadf8\uc778",
  emptyQueue: "\uac80\uc218 \ub300\uae30 \uc911\uc778 5\uc704\uad8c \ubcc0\ub3d9 \uae30\ub85d\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.",
  tempVideoMissing: "\uac80\uc218\uc6a9 \uc784\uc2dc \ub3d9\uc601\uc0c1\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.",
  note: "\uba54\ubaa8",
  noteEmpty: "\uba54\ubaa8 \uc5c6\uc74c",
  keep: "\ud1b5\uacfc \uc720\uc9c0",
  reject: "\ubd88\ud569\uaca9 \uc0ad\uc81c",
  noRecords: "\uc0ad\uc81c\ud560 \uae30\ub85d\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.",
  deleteRecord: "\uae30\ub85d \uc0ad\uc81c",
  top5Changed: "TOP 5 \ubcc0\ub3d9",
  adminOnly: "\uad00\ub9ac\uc790 \uc804\uc6a9",
  reviewTitle: "\uae30\ub85d \uac80\uc218 \ubc0f \uc0ad\uc81c",
  reviewDesc: "\uc804\uad6d 5\uc704\uad8c\uc5d0 \uc0c8\ub85c \ub4e4\uc5b4\uc628 \uae30\ub85d\ub9cc \uc800\uc6a9\ub7c9 \uac80\uc218 \uc601\uc0c1\uc73c\ub85c \uc784\uc2dc \uc800\uc7a5\ub418\uba70, \uac80\uc218 \ud6c4 \ubc14\ub85c \uc9c0\uc6cc\uc9d1\ub2c8\ub2e4.",
  logout: "\ub85c\uadf8\uc544\uc6c3",
  queueTitle: "5\uc704\uad8c \ubcc0\ub3d9 \uac80\uc218",
  recordsTitle: "\uc804\uccb4 \uae30\ub85d \uad00\ub9ac",
  regionFilter: "\uc9c0\uc5ed \ud544\ud130",
  all: "\uc804\uccb4",
};

function AdminLogin({ onLogin, error }) {
  const [password, setPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onLogin(password);
    setPassword("");
  }

  return (
    <div className="admin-login">
      <p>{TEXT.loginDesc}</p>
      <form className="admin-login-form" onSubmit={handleSubmit}>
        <label>
          <span>{TEXT.password}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={TEXT.passwordPlaceholder}
          />
        </label>
        <button type="submit" className="primary-btn">{TEXT.login}</button>
      </form>
      {error ? <div className="form-status">{error}</div> : null}
    </div>
  );
}

function QueueList({ items, videoUrls, onApprove, onReject }) {
  if (!items.length) return <div className="empty-panel">{TEXT.emptyQueue}</div>;

  return (
    <div className="admin-queue">
      {items.map((item) => (
        <article key={item.id} className="admin-video-card">
          <div className="admin-card-head">
            <div>
              <strong>{item.nickname}</strong>
              <span>{item.region} · {item.recordKg}kg</span>
            </div>
            <span className="admin-badge">{TEXT.top5Changed}</span>
          </div>

          {videoUrls[item.id] ? (
            <video className="admin-video" controls src={videoUrls[item.id]} preload="metadata" />
          ) : (
            <div className="empty-panel">{TEXT.tempVideoMissing}</div>
          )}

          <div className="admin-note-block">
            <strong>{TEXT.note}</strong>
            <p>{item.notes || TEXT.noteEmpty}</p>
          </div>

          <div className="admin-actions">
            <button type="button" className="secondary-btn" onClick={() => onApprove(item.id)}>{TEXT.keep}</button>
            <button type="button" className="primary-btn danger-btn" onClick={() => onReject(item.id)}>{TEXT.reject}</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function RecordsTable({ records, onDeleteRecord }) {
  if (!records.length) return <div className="empty-panel">{TEXT.noRecords}</div>;

  return (
    <div className="admin-records">
      {records.map((record) => (
        <div key={record.id} className="admin-record-row">
          <div className="admin-record-copy">
            <strong>{record.nickname}</strong>
            <span>{record.region} · {record.recordKg}kg · {new Date(record.createdAt).toLocaleString("ko-KR")}</span>
            <p>{record.notes || TEXT.noteEmpty}</p>
          </div>
          <button type="button" className="secondary-btn danger-outline" onClick={() => onDeleteRecord(record.id)}>
            {TEXT.deleteRecord}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function AdminPanel({
  isAuthenticated,
  loginError,
  reviewQueue,
  records,
  onLogin,
  onLogout,
  onApproveRecord,
  onRejectRecord,
  onDeleteRecord,
}) {
  const [videoUrls, setVideoUrls] = useState({});
  const [recordRegion, setRecordRegion] = useState(TEXT.all);
  const queuedRecords = reviewQueue.map((id) => records.find((record) => record.id === id)).filter(Boolean);
  const queuedRecordKey = reviewQueue.join(",");
  const filteredRecords = useMemo(() => {
    if (recordRegion === TEXT.all) return records;
    return records.filter((record) => record.region === recordRegion);
  }, [recordRegion, records]);

  useEffect(() => {
    if (!isAuthenticated || !queuedRecords.length) {
      setVideoUrls((current) => {
        Object.values(current).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
      return undefined;
    }

    let active = true;
    const previousUrls = [];

    (async () => {
      const entries = await Promise.all(
        queuedRecords.map(async (record) => {
          const blob = await getVideo(record.id);
          return blob ? [record.id, URL.createObjectURL(blob)] : [record.id, null];
        }),
      );

      if (!active) {
        entries.forEach(([, url]) => { if (url) URL.revokeObjectURL(url); });
        return;
      }

      setVideoUrls((current) => {
        previousUrls.push(...Object.values(current));
        return Object.fromEntries(entries.filter(([, url]) => Boolean(url)));
      });
    })();

    return () => {
      active = false;
      previousUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [isAuthenticated, queuedRecordKey]);

  if (!isAuthenticated) {
    return <AdminLogin onLogin={onLogin} error={loginError} />;
  }

  return (
    <div className="admin-panel">
      <div className="admin-head">
        <div>
          <span className="section-kicker">{TEXT.adminOnly}</span>
          <h2>{TEXT.reviewTitle}</h2>
          <p>{TEXT.reviewDesc}</p>
        </div>
        <button type="button" className="secondary-btn" onClick={onLogout}>{TEXT.logout}</button>
      </div>

      <div className="admin-section">
        <h3>{TEXT.queueTitle}</h3>
        <QueueList items={queuedRecords} videoUrls={videoUrls} onApprove={onApproveRecord} onReject={onRejectRecord} />
      </div>

      <div className="admin-section">
        <div className="admin-section-head">
          <h3>{TEXT.recordsTitle}</h3>
          <div className="region-select-wrap admin-region-select">
            <label className="region-select-label" htmlFor="adminRecordRegion">
              {TEXT.regionFilter}
            </label>
            <select id="adminRecordRegion" className="region-select" value={recordRegion} onChange={(event) => setRecordRegion(event.target.value)}>
              <option value={TEXT.all}>{TEXT.all}</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>
        <RecordsTable records={filteredRecords} onDeleteRecord={onDeleteRecord} />
      </div>
    </div>
  );
}
