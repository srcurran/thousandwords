import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';


interface TypingTextProps {
  text: string;
  onComplete?: () => void;
  isLoading?: boolean;
}

export function TypingText({ text, onComplete, isLoading }: TypingTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 80);

      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, onComplete]);

  return (
<SafeAreaView style={styles.textWrapper}>
  <View style={styles.contentWrapper}>
    <Text style={styles.text}>
      {displayText}
    </Text>
  </View>
</SafeAreaView>
        
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'System',
  },
  textWrapper: {
    flex: 1,
  },
  contentWrapper: {

  },
});
