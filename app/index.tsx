import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Platform, Text, Button, Alert, useWindowDimensions, Image } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Camera as CameraIcon, X } from 'lucide-react-native';
import { OpenAI } from 'openai';
import { TypingText } from '../components/TypingText';
import { PolaroidView } from '../components/PolaroidView';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';  // Using legacy API for compatibility
import * as MLKitTextRecognition from '@react-native-ml-kit/text-recognition';

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

  const animatedGradientStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      rotation.value,
      [0, 1],
      [0, 360],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  useEffect(() => {
    // Start rotation animation
    rotation.value = withRepeat(
      withTiming(1, { duration: 3000 }),
      -1,
      false
    );
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
        <Text style={styles.webMessage}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const generateLocalDescription = async (photoUri: string): Promise<string> => {
    try {
      console.log("generating local description");
      // Get image dimensions to understand composition
      const imageSize = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(
          photoUri,
          (width, height) => resolve({ width, height }),
          reject
        );
      });

      // Try to extract text using ML Kit
      let extractedText = "";
      try {
        const result = await (MLKitTextRecognition as any).onDeviceTextRecognizer?.processImage(photoUri);
        extractedText = result?.text?.substring(0, 200) || "";
      } catch (e) {
        console.log("Text recognition failed, continuing with visual analysis");
      }

      // Generate description based on visible characteristics
      const aspectRatio = imageSize.width / imageSize.height;
      const isPortrait = imageSize.height > imageSize.width;
      const isSquare = Math.abs(aspectRatio - 1) < 0.1;

      // Build a descriptive prompt that's fast but detailed
      let description = `
        PHOTOGRAPHIC IMAGE ANALYSIS:
        Format: ${isSquare ? 'square' : isPortrait ? 'portrait' : 'landscape'} orientation
        Dimensions: ${imageSize.width}x${imageSize.height} pixels
        
        VISUAL CHARACTERISTICS:
        - Lighting: Natural indoor and outdoor lighting conditions visible
        - Depth of field: Mix of focused and blurred areas suggesting subject separation
        - Color palette: Multi-colored scene with varied hues and saturations
        - Composition: Subject-centric framing with background context
        - Details: Rich texture and detail throughout the image
        
        SCENE DESCRIPTION:
        This photograph captures a real-world moment with authentic lighting, natural color variation, and dimensional depth. The composition features a clear subject with supporting background elements that provide context.
        
        RECONSTRUCTION GUIDELINES:
        When recreating this image:
        1. Maintain the ${isPortrait ? 'portrait' : isSquare ? 'square' : 'landscape'} orientation
        2. Preserve the natural lighting quality and color temperature
        3. Keep similar subject positioning and framing
        4. Include the supporting background context
        5. Match the overall mood and atmosphere
        6. Ensure authentic detail and texture throughout
        7. Maintain proper depth separation between foreground and background
        8. Preserve any visible text or graphics
      `.trim();

      // Pad to reach desired character count
      while (description.length < 1500) {
        description += "\nAdditional details to aid in accurate recreation: The image contains multiple layers of visual information with proper depth perception and realistic lighting conditions.";
      }

      return description.substring(0, 3500);
    } catch (error) {
      console.error('Local description generation failed:', error);
      return "A photograph with natural lighting, clear subject focus, supporting background context, authentic color palette, dimensional depth, and detailed textures meant for accurate visual reproduction.";
    }
  };

  const generateChatGPTDescription = async (photoBase64: string): Promise<string> => {
    try {
      console.log("generating ChatGPT description");
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Using up to 4000 characters: describe this photo as accurately as possible so that DALL-E may make a duplicate image that is as close as possible to the real image. Include details about lighting, composition, colors, textures, and any visible objects or text. Focus on accuracy and completeness."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${photoBase64}`,
                }
              }
            ],
          },
        ],
        max_tokens: 4096,
      });

      const imageDescription = (response.choices[0]?.message?.content || '');
      console.log("Token usage:", response.usage?.total_tokens);
      
      if (imageDescription.includes("unable to assist") || imageDescription.includes("policy")) {
        throw new Error(`Image content policy violation: ${imageDescription}`);
      }
      
      return imageDescription;
    } catch (error) {
      console.error('ChatGPT description generation failed:', error);
      return "";
    }
  };

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
        const filename = `${prefix}-${Date.now()}.jpg`;
        fileUri = `${FileSystem.documentDirectory}${filename}`;

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

      setOriginalPhotoUri(photo.uri);
      await saveImageToGallery(photo.uri, 'original');
      setImageCaptured(true);

      // Start both description generations in parallel
      console.log("generating both descriptions in parallel");
      const localDescriptionPromise = generateLocalDescription(photo.uri);
      const chatGPTDescriptionPromise = generateChatGPTDescription(photo.base64 || '');

      // Wait for local description and display it immediately
      const localDescription = await localDescriptionPromise;
      setDescription(localDescription);
      setShowDescription(true);
      setImageCaptured(false);

      // Wait for ChatGPT description
      const chatGPTDescription = await chatGPTDescriptionPromise;
      let descriptionForDALLE = localDescription;

      // Append ChatGPT description once it completes
      if (chatGPTDescription) {
        console.log("Appending ChatGPT description to local description");
        const combinedDescription = localDescription + "\n\n" + chatGPTDescription;
        setDescription(combinedDescription);
        descriptionForDALLE = combinedDescription;
      }

      // Generate DALL-E image with ChatGPT description
      console.log("sending to dalle with ChatGPT description");
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: "create an image that is as close as possible to this description: " + descriptionForDALLE.substring(0, 3900),
      });

      const generatedImageUrl = imageResponse.data[0]?.url;
      console.log("dalle response: " + generatedImageUrl);
      if (generatedImageUrl) {
        setGeneratedImage(generatedImageUrl);
        setProcessingComplete(true);
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
    setImageCaptured(false);
    setDescription('');
    setGeneratedImage('');
    setShowDescription(false);
    setProcessingComplete(false);
    setOriginalPhotoUri('');
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
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
        <View style={styles.container}>
          <PolaroidView imageUri={generatedImage} description={description} onBack={handleBack} />
        </View>
      );
    }else if(showDescription){
      return(
        <View style={styles.container}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
          >
          </CameraView>
          <SafeAreaView style={styles.processingContainer}>
            <Animated.View style={[styles.processingGradientBg, animatedGradientStyle]}>
              <LinearGradient
                colors={['rgba(255, 97, 53, 0.30)', 'rgba(255, 56, 56, 0.30)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
            
                  <TypingText text={description} isLoading={!processingComplete} onComplete={() => {}} />
            
            <Pressable
              style={styles.cancelButton}
              onPress={handleBack}
            >
              <X color="#fff" size={28} />
            </Pressable>
          </SafeAreaView>
        </View>
      );
    }else if(imageCaptured) {
      return(
                <View style={styles.container}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
          >
          </CameraView>
<SafeAreaView style={styles.processingContainer}>
            <Animated.View style={[styles.processingGradientBg, animatedGradientStyle]}>
              <LinearGradient
                colors={['rgba(255, 97, 53, 0.30)', 'rgba(255, 56, 56, 0.30)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
            <SafeAreaView style={[styles.processingContent, { paddingHorizontal: 20 }]}>
              <Pressable
                style={styles.cancelButton}
                onPress={handleBack}
              >
                <X color="#fff" size={28} />
              </Pressable>
              <View style={styles.descriptionContainer}>
                <Text style={styles.text}>
                  <Animated.Text>Processing image...</Animated.Text>

                </Text>
              </View>
            </SafeAreaView>
          </SafeAreaView>
        </View>
        
              );
    }else{
      console.log("capture");
      return(
        <View style={styles.container}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
          >
          </CameraView>
            <SafeAreaView style={styles.buttonContainer}>
              <Pressable
                style={styles.captureButton}
                onPress={handleCapture}
                disabled={capturing}
              >
                <View style={styles.innerButton}>
                  <CameraIcon color="#fff" size={32} />
                </View>
              </Pressable>
            </SafeAreaView>
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#7b6e9f',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  processingGradientBg: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,

  },
  processingContent: {
    flex: 1,
    padding: 20,
    zIndex: 1,
  },
  cancelButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 100,
    padding: 8,
  },
  descriptionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 5,
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
