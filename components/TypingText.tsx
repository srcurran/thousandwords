import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

interface TypingTextProps {
  initMessage?: string;
  scanningMessage?: string;
  text: string;
  onComplete?: () => void;
  isLoading?: boolean;
}

export function TypingText({
  initMessage,
  scanningMessage,
  text,
  onComplete,
  isLoading,
}: TypingTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'init' | 'scanning' | 'content'>('init');
  const cursorOpacity = useSharedValue(1);

  // Reset animation when text changes
  useEffect(() => {
    setDisplayText('');
    setCurrentIndex(0);
    setPhase(initMessage ? 'init' : scanningMessage ? 'scanning' : 'content');
  }, [text, initMessage, scanningMessage]);

  // Smooth pulse animation for cursor
  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 800 }),
        withTiming(1, { duration: 800 }),
      ),
      -1,
      false,
    );
  }, []);

  useEffect(() => {
    let currentText = text;
    if (phase === 'init' && initMessage) {
      currentText = initMessage;
    } else if (phase === 'scanning' && scanningMessage) {
      currentText = scanningMessage;
    }

    if (currentIndex < currentText.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + currentText[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 40);

      return () => clearTimeout(timeout);
    } else if (phase === 'init') {
      // Init message complete, pause 800ms then clear and start scanning
      const pauseTimeout = setTimeout(() => {
        setDisplayText('');
        setCurrentIndex(0);
        setPhase(scanningMessage ? 'scanning' : 'content');
      }, 800);

      return () => clearTimeout(pauseTimeout);
    } else if (phase === 'scanning') {
      // Scanning message complete, clear and start content when text changes
      // Don't auto-transition, wait for text to update
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, phase, onComplete, initMessage, scanningMessage]);

  // When text changes while in scanning phase, transition to content
  useEffect(() => {
    if (phase === 'scanning' && text && text !== scanningMessage) {
      setDisplayText('');
      setCurrentIndex(0);
      setPhase('content');
    }
  }, [text, phase, scanningMessage]);

  const animatedCursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const isTyping = currentIndex < text.length;
  const shouldShowCursor = isTyping || isLoading;

  return (
    <SafeAreaView style={styles.textWrapper}>
      <View style={styles.contentWrapper}>
        <Text style={styles.text}>
          {displayText}
          {shouldShowCursor && (
            <Animated.Text style={[styles.cursor, animatedCursorStyle]}>
              |
            </Animated.Text>
          )}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#e6e6e6',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Courier',
  },
  cursor: {
    color: 'rgb(228, 221, 255)',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Courier',
  },
  textWrapper: {
    flex: 1,
  },
  contentWrapper: {
    padding: 20,
  },
});
