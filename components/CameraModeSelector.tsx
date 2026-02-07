import { Text, StyleSheet, View, Pressable } from 'react-native';

interface Mode {
  id: string;
  label: string;
}

interface CameraModeSelectorProps {
  modes: Mode[];
  selectedMode: string;
  onModeChange: (mode: string) => void;
  isLandscape?: boolean;
}

export function CameraModeSelector({
  modes,
  selectedMode,
  onModeChange,
  isLandscape = false,
}: CameraModeSelectorProps) {
  // Reverse mode order for landscape (to match design: Disposable at top, Photorealistic at bottom)
  const displayModes = isLandscape ? [...modes].reverse() : modes;

  return (
    <View style={[styles.container, isLandscape && styles.containerLandscape]}>
      {displayModes.map((mode) => (
        <Pressable
          key={mode.id}
          onPress={() => onModeChange(mode.id)}
          style={[styles.modeItem, isLandscape && styles.modeItemLandscape]}
        >
          <Text
            style={[
              styles.modeText,
              isLandscape && styles.modeTextLandscape,
              mode.id === selectedMode && styles.modeTextSelected,
            ]}
          >
            {mode.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  containerLandscape: {
    flexDirection: 'column',
    gap: 24,
    alignItems: 'flex-end',
  },
  modeItem: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modeItemLandscape: {
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  modeText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.6,
  },
  modeTextLandscape: {
    // No rotation needed - text stays horizontal in landscape
  },
  modeTextSelected: {
    fontWeight: '600',
    opacity: 1,
    fontSize: 18,
  },
});
