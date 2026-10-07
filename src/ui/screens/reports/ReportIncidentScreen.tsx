import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Evidence } from '@/modules/reports/domain/Evidence';
import type { GroundReport, SeverityAssessment } from '@/modules/reports/domain/GroundReport';
import type { ReportLocation } from '@/modules/reports/domain/ReportLocation';
import { ReportStatus } from '@/modules/reports/domain/ReportStatus';
import { useSafeZone } from '../../AppContext';
import { Icon } from '../../components/Icon';
import { Button, Card, Field, Notice, Segmented } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { useAction } from '../../lib/useAction';

const SEVERITY_OPTIONS: readonly { value: SeverityAssessment; label: string }[] = [
  { value: 'LOW', label: 'Low Risk' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High / Critical' },
];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** UC02 main flow steps 1-10 (plus E1 GPS fallback, E2 offline, E3 missing fields, E4 invalid photo). */
export function ReportIncidentScreen() {
  const { app, user } = useSafeZone();
  const [hazardTypeCode, setHazardTypeCode] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<SeverityAssessment | ''>('');
  const [location, setLocation] = useState<ReportLocation>();
  const [manual, setManual] = useState({ open: false, districtId: user.homeDistrictId, place: '' });
  const [photos, setPhotos] = useState<Evidence[]>([]);
  const [submitted, setSubmitted] = useState<GroundReport>();
  const gpsAction = useAction();
  const photoAction = useAction();
  const submitAction = useAction();

  const clear = submitAction.clearFields;

  const detectLocation = () =>
    gpsAction.run(async () => {
      try {
        setLocation(await app.reportSubmission.detectLocation());
        clear('location');
      } catch (error) {
        setManual((m) => ({ ...m, open: true }));
        throw error;
      }
    });

  const applyManualLocation = () =>
    gpsAction.run(() => {
      setLocation(app.reportSubmission.manualLocation(manual.districtId, manual.place));
      clear('location');
      setManual((m) => ({ ...m, open: false }));
    });

  const addPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    for (const file of files) {
      const previewUrl = file.type.startsWith('image/') ? await readAsDataUrl(file) : undefined;
      const photo = await photoAction.run(() =>
        app.reportSubmission.attachPhoto({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, previewUrl }),
      );
      if (photo) {
        setPhotos((current) => [...current, photo]);
        clear('photos');
      }
    }
  };

  const submit = () =>
    submitAction.run(() => {
      const report = app.reportSubmission.submit({ hazardTypeCode, description, severityAssessment: severity, location, photos }, user);
      setSubmitted(report);
    });

  if (submitted) {
    const offline = submitted.status === ReportStatus.PENDING_SYNC;
    return (
      <Screen title="Report submitted">
        <Card tone={offline ? 'warning' : 'success'}>
          <p className="lead">{offline ? 'Saved on this device' : 'Report submitted'}</p>
          <p>
            {offline
              ? 'You are offline. Your report is stored securely as "Pending Synchronization" and will be sent automatically when connectivity returns.'
              : 'Your report is now "Pending Verification". A duty officer has been notified and will review it shortly.'}
          </p>
          <p className="muted small">Reference: {submitted.id}</p>
        </Card>
        <Link className="btn btn--primary btn--block" to={`/my-reports/${submitted.id}`}>
          Track this report
        </Link>
        <Button variant="secondary" block onClick={() => window.location.reload()}>
          Report another hazard
        </Button>
      </Screen>
    );
  }

  const errors = submitAction.fieldErrors;
  return (
    <Screen title="Report Incident" subtitle="Help authorities and citizens by submitting real-time updates.">
      {!app.connectivity.isOnline() && <Notice tone="warning">You are offline. Reports are saved on the device and sent when you reconnect.</Notice>}

      <Field label="Incident type" error={errors.hazardTypeCode} htmlFor="hazard-type">
        <select id="hazard-type" value={hazardTypeCode} onChange={(e) => {
            setHazardTypeCode(e.target.value);
            clear('hazardTypeCode');
          }}>
          <option value="">Select Incident Type</option>
          {app.hazardTypes.list().map((type) => (
            <option key={type.code} value={type.code}>
              {type.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Location" error={gpsAction.error ?? errors.location}>
        {location ? (
          <div className="location-box">
            <Icon name="pin" size={18} />
            <span>
              {location.label} <span className="muted">({location.source === 'GPS' ? 'GPS Locked' : 'Entered manually'})</span>
            </span>
            <button type="button" className="link-btn" onClick={() => setManual((m) => ({ ...m, open: true }))}>
              Edit
            </button>
          </div>
        ) : (
          <Button variant="secondary" block onClick={detectLocation} disabled={gpsAction.busy}>
            <Icon name="pin" size={18} /> {gpsAction.busy ? 'Acquiring GPS...' : 'Use my GPS location'}
          </Button>
        )}
      </Field>

      {manual.open && (
        <Card>
          <p className="small strong">Enter the location manually</p>
          <Field label="District" htmlFor="manual-district">
            <select id="manual-district" value={manual.districtId} onChange={(e) => setManual({ ...manual, districtId: e.target.value })}>
              {app.geo.listDistricts().map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nearest town or landmark" htmlFor="manual-place">
            <input id="manual-place" value={manual.place} onChange={(e) => setManual({ ...manual, place: e.target.value })} placeholder="e.g. Kaduwela bridge" />
          </Field>
          <Button onClick={applyManualLocation}>Use this location</Button>
        </Card>
      )}

      <Field label="Description" error={errors.description} htmlFor="description">
        <textarea id="description" rows={4} value={description} onChange={(e) => {
            setDescription(e.target.value);
            clear('description');
          }} placeholder="Provide details about the hazard, water levels, road blockages..." />
      </Field>

      <Field label="Severity assessment" error={errors.severityAssessment}>
        <Segmented<SeverityAssessment | ''> label="Severity assessment" value={severity} onChange={(value) => {
            setSeverity(value);
            clear('severityAssessment');
          }} options={SEVERITY_OPTIONS} />
      </Field>

      <Field label="Add photos" error={photoAction.error ?? errors.photos}>
        <label className="dropzone">
          <Icon name="camera" size={26} />
          <span>Take Photo or Upload</span>
          <input type="file" accept="image/*" capture="environment" multiple onChange={addPhotos} hidden />
        </label>
        {photos.length > 0 && (
          <div className="thumbs">
            {photos.map((photo) => (
              <figure key={photo.id} className="thumb">
                {photo.previewUrl ? <img src={photo.previewUrl} alt={photo.fileName} /> : <span>{photo.fileName}</span>}
                <button type="button" aria-label={`Remove ${photo.fileName}`} onClick={() => setPhotos(photos.filter((p) => p.id !== photo.id))}>
                  ×
                </button>
              </figure>
            ))}
          </div>
        )}
      </Field>

      {submitAction.error && <Notice tone="danger">{submitAction.error}</Notice>}
      <Button block onClick={submit} disabled={submitAction.busy}>
        Submit Urgent Report
      </Button>
    </Screen>
  );
}
