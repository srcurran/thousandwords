import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

interface StreamingImageProps {
  uri: string;
  blurRadius?: number;
}

export const StreamingImage = React.memo(
  function StreamingImage({ uri, blurRadius = 8 }: StreamingImageProps) {
    return (
      <>
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="cover"
          blurRadius={blurRadius}
          onLoad={() => console.log('Image loaded successfully')}
          onError={(e) => console.error('Image load error:', e.nativeEvent.error)}
        />
        <View style={styles.imageCast} />
      </>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if URI actually changed
    return prevProps.uri === nextProps.uri && prevProps.blurRadius === nextProps.blurRadius;
  }
);

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  imageCast: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
