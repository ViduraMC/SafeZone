import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { InvalidPhotoError, type Evidence } from '@/modules/reports/domain/Evidence';
import type { GroundReport, SeverityAssessment } from '@/modules/reports/domain/GroundReport';
import type { ReportLocation } from '@/modules/reports/domain/ReportLocation';
import { ReportStatus } from '@/modules/reports/domain/ReportStatus';
import { useSafeZone } from '../../AppContext';
import { EvidenceImage } from '../../components/EvidenceImage';
import { Icon } from '../../components/Icon';
import { Button, ButtonRow, Card, Field, LinkText, Notice, Row, Segmented, SelectField, TextField, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { useAction } from '../../lib/useAction';
import { useNav } from '../../lib/useNav';
import { colors } from '../../theme';

const SEVERITY_OPTIONS: readonly { value: SeverityAssessment; label: string }[] = [
  { value: 'LOW', label: 'Low Risk' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High / Critical' },
];

type PhotoSource = 'camera' | 'gallery';

/** Opens the camera or the gallery and returns the chosen photos. */
async function pickPhotos(source: PhotoSource): Promise<ImagePicker.ImagePickerAsset[]> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: source === 'gallery' };
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new InvalidPhotoError('Camera permission is needed to take a photo. You can upload one from the gallery instead.');
  }
  try {
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    return result.canceled ? [] : result.assets;
  } catch {
    // E4: the picker could not read the file, so it is not a usable photo.
    throw new InvalidPhotoError('The selected file could not be read as a photo. Please capture it again.');
  }
}

/** UC02 main flow steps 1-10 (plus E1 GPS fallback, E2 offline, E3 missing fields, E4 invalid photo). */
export function ReportIncidentScreen() {
  const { app, user } = useSafeZone();
  const nav = useNav();
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

  const addPhotos = async (source: PhotoSource) => {
    const assets = (await photoAction.run(() => pickPhotos(source))) ?? [];
    for (const asset of assets) {
      const photo = await photoAction.run(() =>
        app.reportSubmission.attachPhoto({
          fileName: asset.fileName ?? 'photo.jpg',
          mimeType: asset.mimeType ?? 'image/jpeg',
          sizeBytes: asset.fileSize ?? 0,
          previewUrl: asset.uri,
        }),
      );
      if (photo) {
        setPhotos((current) => [...current, photo]);
        clear('photos');
      }
    }
  };

  const submit = () =>
    submitAction.run(() => {
      setSubmitted(app.reportSubmission.submit({ hazardTypeCode, description, severityAssessment: severity, location, photos }, user));
    });

  const startAgain = () => {
    setSubmitted(undefined);
    setHazardTypeCode('');
    setDescription('');
    setSeverity('');
    setLocation(undefined);
    setPhotos([]);
  };

  if (submitted) {
    const offline = submitted.status === ReportStatus.PENDING_SYNC;
    return (
      <Screen title="Report submitted">
        <Card tone={offline ? 'warning' : 'success'}>
          <Txt lead>{offline ? 'Saved on this device' : 'Report submitted'}</Txt>
          <Txt>
            {offline
              ? 'You are offline. Your report is stored securely as "Pending Synchronization" and will be sent automatically when connectivity returns.'
              : 'Your report is now "Pending Verification". A duty officer has been notified and will review it shortly.'}
          </Txt>
          <Txt small muted>Reference: {submitted.id}</Txt>
        </Card>
        <Button block onPress={() => nav.go(`/my-reports/${submitted.id}`)}>Track this report</Button>
        <Button block variant="secondary" onPress={startAgain}>Report another hazard</Button>
      </Screen>
    );
  }

  const errors = submitAction.fieldErrors;
  return (
    <Screen title="Report Incident" subtitle="Help authorities and citizens by submitting real-time updates.">
      {!app.connectivity.isOnline() && <Notice tone="warning">You are offline. Reports are saved on the device and sent when you reconnect.</Notice>}

      <Field label="Incident type" error={errors.hazardTypeCode}>
        <SelectField
          label="Incident type"
          placeholder="Select Incident Type"
          value={hazardTypeCode}
          invalid={!!errors.hazardTypeCode}
          onChange={(code) => {
            setHazardTypeCode(code);
            clear('hazardTypeCode');
          }}
          options={app.hazardTypes.list().map((type) => ({ value: type.code, label: type.name }))}
        />
      </Field>

      <Field label="Location" error={gpsAction.error ?? errors.location}>
        {location ? (
          <Row style={styles.locationBox}>
            <Icon name="pin" size={18} color={colors.info} />
            <Txt style={styles.flex}>
              {location.label} <Txt muted>({location.source === 'GPS' ? 'GPS Locked' : 'Entered manually'})</Txt>
            </Txt>
            <LinkText onPress={() => setManual((m) => ({ ...m, open: true }))}>Edit</LinkText>
          </Row>
        ) : (
          <Button variant="secondary" icon="pin" block onPress={() => void detectLocation()} disabled={gpsAction.busy}>
            {gpsAction.busy ? 'Acquiring GPS...' : 'Use my GPS location'}
          </Button>
        )}
      </Field>

      {manual.open && (
        <Card>
          <Txt small strong>Enter the location manually</Txt>
          <Field label="District">
            <SelectField
              label="District"
              value={manual.districtId}
              onChange={(districtId) => setManual({ ...manual, districtId })}
              options={app.geo.listDistricts().map((d) => ({ value: d.id, label: d.name }))}
            />
          </Field>
          <Field label="Nearest town or landmark">
            <TextField label="Nearest town or landmark" value={manual.place} onChangeText={(place) => setManual({ ...manual, place })} placeholder="e.g. Kaduwela bridge" />
          </Field>
          <Button onPress={() => void applyManualLocation()}>Use this location</Button>
        </Card>
      )}

      <Field label="Description" error={errors.description}>
        <TextField
          label="Description"
          multiline
          value={description}
          invalid={!!errors.description}
          onChangeText={(text) => {
            setDescription(text);
            clear('description');
          }}
          placeholder="Provide details about the hazard, water levels, road blockages..."
        />
      </Field>

      <Field label="Severity assessment" error={errors.severityAssessment}>
        <Segmented<SeverityAssessment | ''>
          label="Severity assessment"
          value={severity}
          onChange={(value) => {
            setSeverity(value);
            clear('severityAssessment');
          }}
          options={SEVERITY_OPTIONS}
        />
      </Field>

      <Field label="Add photos" error={photoAction.error ?? errors.photos}>
        <ButtonRow>
          <View style={styles.flex}>
            <Button variant="secondary" icon="camera" onPress={() => void addPhotos('camera')}>Take Photo</Button>
          </View>
          <View style={styles.flex}>
            <Button variant="secondary" icon="file" onPress={() => void addPhotos('gallery')}>Upload</Button>
          </View>
        </ButtonRow>
        {photos.length > 0 && (
          <View style={styles.thumbs}>
            {photos.map((photo) => (
              <View key={photo.id}>
                {photo.previewUrl ? <EvidenceImage uri={photo.previewUrl} size="thumb" /> : <Txt small>{photo.fileName}</Txt>}
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${photo.fileName}`} style={styles.remove} onPress={() => setPhotos(photos.filter((p) => p.id !== photo.id))}>
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Field>

      {submitAction.error && <Notice tone="danger">{submitAction.error}</Notice>}
      <Button block onPress={() => void submit()} disabled={submitAction.busy}>Submit Urgent Report</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  locationBox: { backgroundColor: colors.infoBg, borderRadius: 10, padding: 12, justifyContent: 'flex-start' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  remove: { position: 'absolute', top: -6, right: -6, backgroundColor: colors.text, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.white, fontSize: 16, fontWeight: '800', lineHeight: 18 },
});
