import { useEffect, useRef, useState } from "react";
import { DEFAULT_REGION, REGIONS, deriveRegionFromCoords } from "../lib/records";

const initialForm = {
  nickname: "",
  region: DEFAULT_REGION,
  recordKg: "",
  notes: "",
};

export default function RecordForm({ pendingSubmission, latestResult, onSave }) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("");
  const canSubmit = Boolean(pendingSubmission?.canSubmit);
  const hasRequestedLocationRef = useRef(false);

  function captureLocation(isAutomatic = false) {
    if (!navigator.geolocation) {
      setStatus("이 브라우저에서는 위치 정보를 지원하지 않습니다. 지역을 직접 선택하세요.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const region = deriveRegionFromCoords(position.coords.latitude, position.coords.longitude);
        setForm((prev) => ({ ...prev, region }));
        setStatus(
          isAutomatic
            ? `현재 위치를 확인해 ${region} 지역으로 설정했습니다.`
            : `현재 위치를 다시 확인해 ${region} 지역으로 갱신했습니다.`
        );
      },
      () => {
        setStatus("위치 권한을 가져오지 못했습니다. 지역을 직접 선택하세요.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  useEffect(() => {
    if (!canSubmit) {
      hasRequestedLocationRef.current = false;
      return;
    }
    setStatus("풀스쿼트 인증이 통과되었습니다. 현재 위치를 확인한 뒤 기록을 저장하세요.");
    if (!hasRequestedLocationRef.current) {
      hasRequestedLocationRef.current = true;
      captureLocation(true);
    }
  }, [canSubmit]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) {
      setStatus("먼저 영상을 분석해 풀스쿼트 PASS를 받아야 합니다.");
      return;
    }

    const recordKg = Number(form.recordKg);
    if (!form.nickname.trim() || !Number.isFinite(recordKg) || recordKg <= 0) {
      setStatus("닉네임과 기록(kg)을 정확히 입력하세요.");
      return;
    }

    onSave({
      nickname: form.nickname.trim(),
      region: form.region,
      locationName: form.region,
      recordKg,
      notes: form.notes.trim(),
      latitude: null,
      longitude: null,
    });

    setForm(initialForm);
    setStatus("기록을 저장했습니다. 지도와 랭킹에 바로 반영됩니다.");
    hasRequestedLocationRef.current = false;
  }

  return (
    <div className="record-form-wrap">
      <div className={`gate-banner ${canSubmit ? "pass" : "locked"}`}>
        <strong>{canSubmit ? "PASS 인증 완료" : "PASS 대기 중"}</strong>
        <span>
          {canSubmit
            ? `최대 depth_ratio ${pendingSubmission?.verification?.depthRatioMax?.toFixed?.(2) ?? "-"}`
            : `현재 결과: ${latestResult?.summary ?? "영상 분석 전"}`}
        </span>
      </div>

      <form className="record-form" onSubmit={handleSubmit}>
        <label>
          <span>닉네임</span>
          <input name="nickname" value={form.nickname} onChange={updateField} placeholder="예: squat_lee" />
        </label>

        <label>
          <span>지역</span>
          <select name="region" value={form.region} onChange={updateField}>
            {REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>

        <label className="field-wide">
          <span>스쿼트 기록 (kg)</span>
          <input
            name="recordKg"
            type="number"
            min="1"
            step="0.5"
            value={form.recordKg}
            onChange={updateField}
            placeholder="예: 180"
          />
        </label>

        <label className="field-wide">
          <span>메모</span>
          <textarea
            name="notes"
            value={form.notes}
            onChange={updateField}
            rows="3"
            placeholder="예: 대회 준비 중 / 벨트 착용 / 컨디션 좋음"
          />
        </label>

        <div className="form-actions field-wide">
          <button type="button" className="secondary-btn" onClick={() => captureLocation(false)}>
            지역 다시 확인
          </button>
          <button type="submit" className="primary-btn" disabled={!canSubmit}>
            기록 저장
          </button>
        </div>
      </form>

      <p className="form-status">{status}</p>
    </div>
  );
}
