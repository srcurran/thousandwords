import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface TypingTextProps {
  text: string;
  onComplete?: () => void;
  isLoading?: boolean;
}

export function TypingText({ text, onComplete, isLoading }: TypingTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  const dotOpacity = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(
        withTiming(0.3, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1
    ),
  }));

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 50);

      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, onComplete]);

  return (
    <Text style={styles.text}>
      {displayText}
      {(currentIndex < text.length || isLoading) && (
        <Animated.Text style={[styles.dots, dotOpacity]}>...</Animated.Text>
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'System',
  },
  dots: {
    color: '#fff',
  },
});