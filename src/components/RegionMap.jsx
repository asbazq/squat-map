import { useEffect, useMemo, useState } from "react";
import { divIcon } from "leaflet";
import { GeoJSON, Marker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_REGION, REGION_COORDS, getRegionMapData } from "../lib/records";

const KOREA_CENTER = [36.35, 127.8];
const KOREA_BOUNDS = [
  [32.8, 124.5],
  [39.0, 131.0],
];

const GEOJSON_NAME_TO_REGION = {
  Seoul: "서울",
  Busan: "부산",
  Daegu: "대구",
  Incheon: "인천",
  Gwangju: "광주",
  Daejeon: "대전",
  Ulsan: "울산",
  "Gyeonggi-do": "경기",
  "Gangwon-do": "강원",
  "Chungcheongbuk-do": "충북",
  "Chungcheongnam-do": "충남",
  "Jeollabuk-do": "전북",
  "Jeollanam-do": "전남",
  "Gyeongsangbuk-do": "경북",
  "Gyeongsangnam-do": "경남",
  Jeju: "제주",
};

function FlyToRegion({ selectedRegion }) {
  const map = useMap();
  const center = REGION_COORDS[selectedRegion] ?? REGION_COORDS[DEFAULT_REGION];
  map.flyTo([center.lat, center.lng], selectedRegion === DEFAULT_REGION ? 7 : 9, {
    animate: true,
    duration: 0.8,
  });
  return null;
}

function createRegionIcon(region, active) {
  const className = active ? "region-marker active" : "region-marker";
  return divIcon({
    className: "region-marker-wrap",
    html: `<button class="${className}" type="button"><strong>${region}</strong></button>`,
    iconSize: active ? [64, 34] : [52, 28],
    iconAnchor: active ? [32, 17] : [26, 14],
  });
}

export default function RegionMap({ records, selectedRegion, onSelectRegion }) {
  const [boundaryData, setBoundaryData] = useState(null);
  const regionData = getRegionMapData(records);
  const selectedData = regionData.find((item) => item.region === selectedRegion);

  useEffect(() => {
    let active = true;
    fetch("/skorea-provinces-geo.json")
      .then((response) => response.json())
      .then((data) => {
        if (active) setBoundaryData(data);
      })
      .catch((error) => {
        console.error("failed to load province boundaries", error);
      });
    return () => {
      active = false;
    };
  }, []);

  const boundaryStyle = useMemo(
    () => (feature) => {
      const name = feature?.properties?.NAME_1;
      const region = GEOJSON_NAME_TO_REGION[name];
      const isSelected = region === selectedRegion;
      return {
        color: isSelected ? "#db5b2c" : "#8c98a1",
        weight: isSelected ? 3 : 1,
        fillColor: isSelected ? "#db5b2c" : "#dfe6eb",
        fillOpacity: isSelected ? 0.24 : 0.06,
      };
    },
    [selectedRegion]
  );

  const handleEachFeature = (feature, layer) => {
    const region = GEOJSON_NAME_TO_REGION[feature?.properties?.NAME_1];
    if (!region) return;
    layer.on({ click: () => onSelectRegion(region) });
  };

  return (
    <div className="map-board">
      <div className="map-canvas">
        <MapContainer
          center={KOREA_CENTER}
          zoom={7}
          minZoom={6}
          maxZoom={13}
          scrollWheelZoom
          maxBounds={KOREA_BOUNDS}
          className="leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyToRegion selectedRegion={selectedRegion} />
          {boundaryData ? <GeoJSON data={boundaryData} style={boundaryStyle} onEachFeature={handleEachFeature} /> : null}
          {regionData.map((item) => (
            <Marker
              key={item.region}
              position={[item.position.lat, item.position.lng]}
              icon={createRegionIcon(item.region, item.region === selectedRegion)}
              eventHandlers={{ click: () => onSelectRegion(item.region) }}
            >
              <Popup>
                <strong>{item.region}</strong>
                <div>인증 기록 {item.count}명</div>
                <div>{item.leader ? `지역 1위 ${item.leader.nickname} · ${item.leader.recordKg}kg` : "아직 기록 없음"}</div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="map-feed">
        <h3>{selectedRegion} 최근 등록</h3>
        {selectedData?.recent?.length ? (
          <ul className="pin-feed">
            {selectedData.recent.map((record) => (
              <li key={record.id}>
                <strong>{record.nickname}</strong>
                <span>{record.region} · {record.recordKg}kg</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-panel">이 지역에 아직 저장된 기록이 없습니다.</div>
        )}
      </div>
    </div>
  );
}
