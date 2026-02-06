import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Platform, Text, Button, Alert, useWindowDimensions } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
} from 'react-native-reanimated';
import { Camera as CameraIcon, X } from 'lucide-react-native';
import { OpenAI } from 'openai';
import { TypingText } from '../components/TypingText';
import { PolaroidView } from '../components/PolaroidView';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';  // Correct import

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [capturing, setCapturing] = useState(false);
  const [imageCaptured, setImageCaptured] = useState(false);
  const [description, setDescription] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [showDescription, setShowDescription] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [originalPhotoUri, setOriginalPhotoUri] = useState<string>('');
  const rotation = useSharedValue(0);
  const cameraRef = useRef<CameraView>(null);
  const { width, height } = useWindowDimensions();
  
  // Determine if in landscape orientation
  const isLandscape = width > height;
  
  // Calculate rotation angle for icons to keep them upright
  // In landscape, rotate by -90 degrees to counteract the view rotation
  const iconRotation = isLandscape ? -90 : 0;

  useEffect(() => {
    // Request media library permissions on component mount
    if (!mediaPermission) {
      requestMediaPermission();
    }
  }, []);

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={styles.webMessage}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const saveImageToGallery = async (uri: string, prefix: string) => {
    try {
      if (!mediaPermission?.granted) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('Media library permission not granted');
          return;
        }
      }

      // For remote URLs (starting with http/https), download the file first
      let fileUri = uri;
      if (uri.startsWith('http')) {
        fileUri = `${FileSystem.Directory}${prefix}-${Date.now()}.jpg`;

        // This is the correct way to use downloadAsync
        const downloadResult = await FileSystem.downloadAsync(uri, fileUri);

        if (downloadResult.status !== 200) {
          console.error('Failed to download image');
          return;
        }
        fileUri = downloadResult.uri;
      }

      const asset = await MediaLibrary.createAssetAsync(fileUri);
      await MediaLibrary.createAlbumAsync('Thousand Words', asset, false);
      console.log(`${prefix} image saved to gallery`);
    } catch (error) {
      // console.error(`Failed to save ${prefix} image:`, error);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      console.log("capturing");
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: true,
      });

      // Save original photo URI for auto-saving later

      setOriginalPhotoUri(photo.uri);

      // Auto-save the original photo
      await saveImageToGallery(photo.uri, 'original');

      setImageCaptured(true);
      // Process with GPT-4V
      console.log("sending photo");
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Using 4000 characters: describe this photo as accurately as possible so that Dall-E may make a duplicate image that is as close as possible to the real image. When you have completed the first draft count the words & then add more words to reach the 4000 characters. "
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${photo?.base64}`,
                }
              }
            ],
          },
        ],
        max_tokens: 4096,
      });

      console.log("Token usage:", response.usage?.total_tokens);

      const imageDescription = "make a realistic photo using the following description: " + (response.choices[0]?.message?.content || '');
      // console.log("gpt 4o response: " + imageDescription);
      setDescription(imageDescription);1
      setShowDescription(true);
      setImageCaptured(false);
      // Generate image with DALL-E
      console.log("sending to dalle: "+ imageDescription);
      const imageResponse = await openai.images.generate({
        model: "gpt-image-1.5",
        prompt: imageDescription.substring(0, 3900),
      });

      const generatedImageUrl = imageResponse.data[0]?.url;
      console.log("dalle response: " + generatedImageUrl);
      if (generatedImageUrl) {
        setGeneratedImage(generatedImageUrl);
        setProcessingComplete(true);

        // Auto-save the generated image
        await saveImageToGallery(generatedImageUrl, 'generated');
      }
    } catch (error) {
      console.error('Failed to process image:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleBack = () => {
    setDescription('');
    setGeneratedImage('');
    setShowDescription(false);
    setProcessingComplete(false);
    setOriginalPhotoUri('');
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#2D1B69', '#1E1B26']}
          style={styles.gradient}
        />
        <View style={styles.webMessage}>
          <Text style={styles.webMessageText}>
            Camera functionality is not available on web platforms.
            Please use a mobile device to access this feature.
          </Text>
        </View>
      </View>
    );
  }

  if (permission.granted) {
    if(processingComplete) {
      return(
        <CameraView
          ref={cameraRef}
          style={styles.camera}
        >
          <SafeAreaView style={styles.processingContainer}>
            <PolaroidView imageUri={generatedImage} description={description} onBack={handleBack} />
          </SafeAreaView>
        </CameraView>
      );
    }else if(showDescription){
      return(

        <CameraView
          ref={cameraRef}
          style={styles.camera}
        >
        <SafeAreaView style={styles.processingContainer}>
          <Pressable
            style={styles.cancelButton}
            onPress={handleBack}
          >
            <X color="#fff" size={28} />
          </Pressable>
          <View style={[styles.descriptionContainer, { transform: [{ rotate: `${iconRotation}deg` }] }]}>
            <TypingText text={description} isLoading={!processingComplete} onComplete={() => {
            }} />
          </View>
        </SafeAreaView>
        </CameraView>
      );
    }else if(imageCaptured) {
      return(
        <CameraView
          ref={cameraRef}
          style={styles.camera}
        >
          <SafeAreaView style={styles.processingContainer}>
            <Pressable
              style={styles.cancelButton}
              onPress={handleBack}
            >
              <X color="#fff" size={28} />
            </Pressable>
            <View style={[styles.descriptionContainer, { transform: [{ rotate: `${iconRotation}deg` }] }]}>
              <Text style={styles.text}>
                <Animated.Text>Processing image...</Animated.Text>
              </Text>
            </View>
          </SafeAreaView>
        </CameraView>
      );
    }else{
      console.log("capture");
      return(
        <View style={styles.container}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
          >
            <SafeAreaView style={styles.buttonContainer}>
              <Pressable
                style={styles.captureButton}
                onPress={handleCapture}
                disabled={capturing}
              >
                <Animated.View>
                  <LinearGradient
                    colors={['#9C27B0', '#673AB7']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                </Animated.View>
                <View style={[styles.innerButton, { transform: [{ rotate: `${iconRotation}deg` }] }]}>
                  <CameraIcon color="#fff" size={32} />
                </View>
              </Pressable>
            </SafeAreaView>
          </CameraView>
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1B26',
  },
  gradient: {
    opacity: .8,
    ...StyleSheet.absoluteFillObject,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientContainer: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  buttonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  innerButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2D1B69',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 38, 0.8)',
    padding: 20,
  },
  cancelButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  webMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webMessageText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'System',
  },
});
