import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { Save, ArrowLeft } from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';  // Correct import
import { SafeAreaView } from 'react-native-safe-area-context';

interface PolaroidViewProps {
  imageUri: string;
  description: string;
  onBack: () => void;
}

export function PolaroidView({ imageUri, description, onBack }: PolaroidViewProps) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to save images');
        setSaving(false);
        return;
      }

      // For remote URLs (starting with http/https), we need to download the file first
      if (imageUri.startsWith('http')) {
        const fileUri = `${FileSystem.documentDirectory}dalle-image-${Date.now()}.jpg`;
        // This is the correct way to use downloadAsync in expo-file-system
        const downloadResult = await FileSystem.downloadAsync(imageUri, fileUri);

        if (downloadResult.status === 200) {
          const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
          await MediaLibrary.createAlbumAsync('Thousand Words', asset, false);
        } else {
        }
      } else {
        // For local URIs, we can save directly
        const asset = await MediaLibrary.createAssetAsync(imageUri);
        await MediaLibrary.createAlbumAsync('Thousand Words', asset, false);
      }
    } catch (error) {
      console.error('Failed to save image:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft color="#fff" size={24} />
        </Pressable>
        <Pressable onPress={handleSave} style={styles.saveButton}>
          <Save color="#fff" size={24} />
        </Pressable>
      </View>
      <View style={styles.polaroid}>
        <Image source={{ uri: imageUri }} style={styles.image} />
        <View style={styles.caption}>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1B26',
    padding: 20,
    justifyContent: 'center',
    marginTop: -100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  saveButton: {
    padding: 8,
  },
  polaroid: {
    backgroundColor: '#fff',
    padding: 10,
    paddingBottom: 40,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 2,
  },
  caption: {
    padding: 15,
  },
  captionText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
});
