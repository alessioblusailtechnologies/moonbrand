import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Moon } from './brand';
import { colors } from './theme';

// L'attesa all'avvio, sul blu notte dello splash: il marchio e un indicatore.
export function Splash() {
  return (
    <View style={styles.root}>
      <Moon size={84} />
      <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
});
