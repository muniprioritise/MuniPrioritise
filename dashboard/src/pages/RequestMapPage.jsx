import { useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchReports } from '../services/dashboardApi.js';
import { CATEGORY_COLORS, formatDateTime } from '../utils/dashboardData.js';

const DEFAULT_CENTER = [-33.9249, 18.4241];

function RequestMapPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setError('');
      setIsLoading(true);
      try {
        const rows = await fetchReports(token);
        if (!mounted) {
          return;
        }
        setReports(rows);
        if (rows.length > 0) {
          setSelectedId(rows[0].id);
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.message || 'Unable to load request map.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  const mapCenter = useMemo(() => {
    if (!reports.length) {
      return DEFAULT_CENTER;
    }
    const lat = reports.reduce((sum, report) => sum + report.lat, 0) / reports.length;
    const lng = reports.reduce((sum, report) => sum + report.lng, 0) / reports.length;
    return [lat, lng];
  }, [reports]);

  const selected = reports.find((report) => report.id === selectedId);

  if (isLoading) {
    return <p className="panel-message">Loading request map...</p>;
  }

  if (error) {
    return <p className="panel-message panel-error">{error}</p>;
  }

  return (
    <section className="split-layout">
      <div className="map-panel">
        <div className="map-toolbar">
          <label className="toggle-row" htmlFor="heatmap-toggle">
            <input
              id="heatmap-toggle"
              type="checkbox"
              checked={showHeatmap}
              onChange={(event) => setShowHeatmap(event.target.checked)}
            />
            Heatmap overlay
          </label>
        </div>

        <MapContainer center={mapCenter} zoom={12} scrollWheelZoom className="leaflet-map">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {showHeatmap && reports.map((report) => (
            <Circle
              key={`heat-${report.id}`}
              center={[report.lat, report.lng]}
              radius={220 + (report.severity * 120)}
              pathOptions={{ color: CATEGORY_COLORS[report.category], fillOpacity: 0.12, weight: 0 }}
            />
          ))}

          {reports.map((report) => (
            <CircleMarker
              key={report.id}
              center={[report.lat, report.lng]}
              radius={6 + report.severity}
              pathOptions={{
                color: '#0d1f2d',
                weight: report.id === selectedId ? 3 : 1,
                fillColor: CATEGORY_COLORS[report.category],
                fillOpacity: 0.95,
              }}
              eventHandlers={{
                click: () => setSelectedId(report.id),
              }}
            >
              <Popup>
                <strong>{report.category}</strong>
                <br />
                {report.description}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <aside className="detail-panel">
        <h3>Selected request detail</h3>
        {!selected && <p className="panel-message">Click a pin to view request details.</p>}
        {selected && (
          <dl className="detail-list">
            <div>
              <dt>Request ID</dt>
              <dd>{selected.id}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{selected.category}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selected.status}</dd>
            </div>
            <div>
              <dt>Ward</dt>
              <dd>{selected.ward_id}</dd>
            </div>
            <div>
              <dt>Severity</dt>
              <dd>{selected.severity}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(selected.created_at)}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{selected.description}</dd>
            </div>
          </dl>
        )}
      </aside>
    </section>
  );
}

export default RequestMapPage;
