import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { BrandSummary } from '@moonbrand/shared/api/contract';

import { fileUrl } from '../lib/api';
import { colors, fonts } from './theme';

// Il marchio di Moonbrand, Transito: un anello e la falce arancio che lo abbraccia, staccata da un filo vuoto.
// È lo stesso disegno del sito (viewBox 10 10 80 80): la falce è il disco (62, 50, r 26.5) coperto dal cerchio
// (38.5, 50, r 30) del colore di fondo, `shade`; l'anello ha centro (38.5, 50), raggio esterno 27 e spessore 6.
export function Moon({ size = 28, shade = colors.primary, ring = colors.white }: { size?: number; shade?: string; ring?: string }) {
  const k = size / 80;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: 25.5 * k,
          top: 13.5 * k,
          width: 53 * k,
          height: 53 * k,
          borderRadius: 26.5 * k,
          overflow: 'hidden',
          backgroundColor: colors.accent,
        }}
      >
        <View style={{ position: 'absolute', left: -27 * k, top: -3.5 * k, width: 60 * k, height: 60 * k, borderRadius: 30 * k, backgroundColor: shade }} />
      </View>
      <View
        style={{
          position: 'absolute',
          left: 1.5 * k,
          top: 13 * k,
          width: 54 * k,
          height: 54 * k,
          borderRadius: 27 * k,
          borderWidth: 6 * k,
          borderColor: ring,
        }}
      />
    </View>
  );
}

export function Wordmark({ light = false, size = 20 }: { light?: boolean; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.4 }}>
      <Moon size={size * 1.75} shade={light ? colors.primary : colors.surface} ring={light ? colors.white : colors.title} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: size, color: light ? colors.white : colors.title, letterSpacing: -size * 0.03 }}>Moonbrand</Text>
    </View>
  );
}

// Il logo del brand o la sua iniziale sul suo colore.
export function BrandAvatar({ brand, size = 32 }: { brand: Pick<BrandSummary, 'name' | 'logoUri' | 'color'>; size?: number }) {
  const logo = fileUrl(brand.logoUri);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: logo ? colors.white : brand.color || colors.primary }]}>
      {logo ? (
        <Image source={{ uri: logo }} style={{ width: size * 0.82, height: size * 0.82 }} contentFit="contain" />
      ) : (
        <Text style={{ color: colors.white, fontFamily: fonts.semibold, fontSize: size * 0.45 }}>{brand.name.charAt(0).toUpperCase() || 'M'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
});
