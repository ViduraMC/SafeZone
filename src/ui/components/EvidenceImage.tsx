import { Image, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

const SVG_DATA_URL = 'data:image/svg+xml';

/**
 * Shows a report photo. Photos from the camera or gallery are file URIs; the
 * demo data uses small generated SVG pictures, which React Native's Image
 * cannot draw, so those go through react-native-svg.
 */
export function EvidenceImage({ uri, size = 'large' }: { uri: string; size?: 'large' | 'thumb' }) {
  const style = size === 'large' ? styles.large : styles.thumb;
  if (uri.startsWith(SVG_DATA_URL)) {
    const xml = decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
    return (
      <View style={[style, styles.clip]}>
        <SvgXml xml={xml} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
      </View>
    );
  }
  return <Image source={{ uri }} style={[style, styles.clip]} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  large: { width: '100%', aspectRatio: 16 / 10, marginBottom: 10 },
  thumb: { width: 84, height: 84 },
  clip: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#ddd' },
});
