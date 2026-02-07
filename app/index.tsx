import { useEffect, useRef, useState } from 'react';
import {
  View,
  Pressable,
  Platform,
  Text,
  Button,
  Alert,
  useWindowDimensions,
  Image,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { TypingText } from '../components/TypingText';
import { CameraModeSelector } from '../components/CameraModeSelector';
import { StreamingImage } from '../components/StreamingImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import {
  generateLocalDescription,
  generateChatGPTDescription,
  generateImageWithStreaming,
  saveImageToGallery,
} from './logic';
import { styles } from './styles';

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] =
    MediaLibrary.usePermissions();
  const [capturing, setCapturing] = useState(false);
  const [imageCaptured, setImageCaptured] = useState(false);
  const [description, setDescription] = useState<string>('');
  const [initMessage, setInitMessage] = useState<string>('');
  const [scanningMessage, setScanningMessage] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [partialImage, setPartialImage] = useState<string>('');
  const [showDescription, setShowDescription] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [originalPhotoUri, setOriginalPhotoUri] = useState<string>('');
  const [cameraMode, setCameraMode] = useState<string>('realistic');
  const rotation = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const buttonOpacity = useSharedValue(1);
  const cameraRef = useRef<CameraView>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { width, height } = useWindowDimensions();

  const animatedGradientStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      rotation.value,
      [0, 1],
      [0, 360],
      Extrapolate.CLAMP,
    );
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const animatedCastStyle = useAnimatedStyle(() => {
    return {
      opacity: buttonOpacity.value,
    };
  });

  useEffect(() => {
    // Start rotation animation
    rotation.value = withRepeat(withTiming(1, { duration: 3000 }), -1, false);
  }, [rotation]);

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
        <Text style={styles.webMessage}>
          We need your permission to show the camera
        </Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const { signal } = abortController;

    try {
      console.log('capturing');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: true,
      });

      if (signal.aborted) return;

      setOriginalPhotoUri(photo.uri);
      await saveImageToGallery(photo.uri, 'original', mediaPermission);
      setImageCaptured(true);

      // Start both description generations in parallel
      console.log('generating both descriptions in parallel');
      const localDescriptionPromise = generateLocalDescription(photo.uri);
      const chatGPTDescriptionPromise = generateChatGPTDescription(
        photo.base64 || '',
        signal,
      );

      // Wait for local description and display it immediately
      const localDescription = await localDescriptionPromise;
      if (signal.aborted) return;

      setInitMessage(localDescription.init);
      setScanningMessage(localDescription.scanning);
      setDescription(localDescription.scanning);
      setShowDescription(true);
      setImageCaptured(false);

      // Wait for ChatGPT description
      const chatGPTDescription = await chatGPTDescriptionPromise;
      if (signal.aborted) return;

      let descriptionForDALLE = localDescription.full;

      // Replace scanning message with ChatGPT description once it completes
      if (chatGPTDescription) {
        console.log('Replacing scanning message with ChatGPT description');
        setDescription(chatGPTDescription);
        descriptionForDALLE = chatGPTDescription;
      }

      // Generate DALL-E image with streaming
      console.log('sending to dalle with streaming');
      const generatedImageUrl = await generateImageWithStreaming(
        descriptionForDALLE,
        cameraMode,
        signal,
        (partialImageUrl) => setPartialImage(partialImageUrl),
      );
      if (signal.aborted) return;

      if (generatedImageUrl) {
        setGeneratedImage(generatedImageUrl);
        setProcessingComplete(true);
        await saveImageToGallery(
          generatedImageUrl,
          'generated',
          mediaPermission,
        );
      }
    } catch (error) {
      if (signal.aborted) return;
      console.error('Failed to process image:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
    } finally {
      if (!signal.aborted) {
        setCapturing(false);
      }
      abortControllerRef.current = null;
    }
  };

  const handleBack = () => {
    // Abort any ongoing API calls
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Reset UI state
    setImageCaptured(false);
    setDescription('');
    setInitMessage('');
    setScanningMessage('');
    setGeneratedImage('');
    setPartialImage('');
    setShowDescription(false);
    setProcessingComplete(false);
    setOriginalPhotoUri('');
    setCapturing(false);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.webMessage}>
          <Text style={styles.webMessageText}>
            Camera functionality is not available on web platforms. Please use a
            mobile device to access this feature.
          </Text>
        </View>
      </View>
    );
  }

  if (permission.granted) {
    if (processingComplete) {
      return (
        <View style={styles.container}>
          <View style={styles.polaroidContainer}>
            <Image
              source={{ uri: generatedImage }}
              style={styles.polaroidImage}
            />
            <SafeAreaView
              style={[styles.polaroidOverlay, { paddingHorizontal: 20 }]}
            >
              <Pressable style={styles.cancelButton} onPress={handleBack}>
                <X color="#fff" size={28} />
              </Pressable>
            </SafeAreaView>
          </View>
        </View>
      );
    } else if (showDescription || imageCaptured) {
      // Unified processing overlay for both states
      return (
        <View style={styles.container}>
          {/* Base camera layer */}
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            zoom={0.05}
          ></CameraView>

          {/* Image layer: shows original photo first, then partial images as they stream in */}
          {showDescription && (
            <View style={styles.partialImageLayer}>
              <StreamingImage uri={partialImage || originalPhotoUri} />
            </View>
          )}

          {/* Processing overlay with gradient and content */}
          <SafeAreaView style={styles.processingContainer}>
            <View style={styles.processingContent}>
              <Pressable style={styles.cancelButton} onPress={handleBack}>
                <X color="#fff" size={28} />
              </Pressable>

              <View style={styles.descriptionContainer}>
                {showDescription ? (
                  <TypingText
                    initMessage={initMessage}
                    scanningMessage={scanningMessage}
                    text={description}
                    isLoading={!processingComplete}
                    onComplete={() => {}}
                  />
                ) : (
                  <Text style={styles.text}>Processing image...</Text>
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>
      );
    } else {
      const isLandscape = width > height;
      return (
        <View style={styles.container}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            zoom={0}
          ></CameraView>
          <SafeAreaView
            style={[
              styles.buttonContainer,
              isLandscape
                ? styles.buttonContainerLandscape
                : styles.buttonContainerPortrait,
            ]}
          >
            <View
              style={[isLandscape && styles.modeSelectorContainerLandscape]}
            >
              <CameraModeSelector
                modes={[
                  { id: 'realistic', label: 'Realistic' },
                  { id: 'super-ai', label: 'SuperAI' },
                  { id: 'cartoon', label: 'Cartoon' },
                  { id: '90s-disposable', label: 'Disposable' },
                ]}
                selectedMode={cameraMode}
                onModeChange={setCameraMode}
                isLandscape={isLandscape}
              />
            </View>
            <Animated.View style={animatedButtonStyle}>
              <Pressable
                style={styles.captureButton}
                onPress={handleCapture}
                onPressIn={() => {
                  buttonScale.value = withTiming(1.15, { duration: 100 });
                  buttonOpacity.value = withTiming(0.4, { duration: 100 });
                }}
                onPressOut={() => {
                  buttonScale.value = withTiming(1, { duration: 150 });
                  buttonOpacity.value = withTiming(0, { duration: 150 });
                }}
                disabled={capturing}
              >
                <View style={styles.innerButton}>
                  <View style={styles.innerCircle} />
                  <Animated.View
                    style={[styles.buttonCast, animatedCastStyle]}
                  />
                </View>
              </Pressable>
            </Animated.View>
          </SafeAreaView>
        </View>
      );
    }
  }
}
