import React, { useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Save, ArrowLeft, X } from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy'; // Using legacy API  // Correct import
import { SafeAreaView } from 'react-native-safe-area-context';

interface PolaroidViewProps {
  imageUri: string;
  description: string;
  onBack: () => void;
}

export function PolaroidView({
  imageUri,
  description,
  onBack,
}: PolaroidViewProps) {
  const [saving, setSaving] = useState(false);
  const { width, height } = useWindowDimensions();

  const handleSave = async () => {
    try {
      setSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant permission to save images',
        );
        setSaving(false);
        return;
      }

      // For remote URLs (starting with http/https), we need to download the file first
      if (imageUri.startsWith('http')) {
        const filename = `dalle-image-${Date.now()}.jpg`;
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        // This is the correct way to use downloadAsync in expo-file-system
        const downloadResult = await FileSystem.downloadAsync(
          imageUri,
          fileUri,
        );

        if (downloadResult.status === 200) {
          const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
          await MediaLibrary.createAlbumAsync('Thousand Words', asset, false);
          Alert.alert('Success', 'Image saved to Thousand Words album');
        } else {
          Alert.alert('Error', 'Failed to download image');
        }
      } else {
        // For local URIs, we can save directly
        const asset = await MediaLibrary.createAssetAsync(imageUri);
        await MediaLibrary.createAlbumAsync('Thousand Words', asset, false);
        Alert.alert('Success', 'Image saved to Thousand Words album');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save image. Please try again.');
      console.error('Failed to save image:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.image} />
      <SafeAreaView
        style={[styles.processingContent, { paddingHorizontal: 20 }]}
      >
        <View style={styles.buttonGroup}>
          <Pressable style={styles.button} onPress={onBack}>
            <X color="#fff" size={28} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  processingContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 20,
    zIndex: 1,
  },
  buttonGroup: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 100,
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    padding: 8,
  },
});
