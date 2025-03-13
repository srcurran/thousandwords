import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Alert, Platform, Text, Button } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';  // Correct import
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  useSharedValue,
} from 'react-native-reanimated';
import { Camera as CameraIcon } from 'lucide-react-native';
import { OpenAI } from 'openai';
import { TypingText } from '../components/TypingText';
import { PolaroidView } from '../components/PolaroidView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { opacity } from 'react-native-reanimated/lib/typescript/Colors';


const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [imageCaptured, setImageCaptured] = useState(false);
  const [description, setDescription] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [showDescription, setShowDescription] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);
  const rotation = useSharedValue(0);
  const cameraRef = useRef<CameraView>(null);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();


  useEffect(() => {
    const getMediaPermission = async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Storage permission is required to save images. Please grant this permission in your device settings.',
        );
      }
    };

    getMediaPermission();
  }, []);

  console.log("permissions: "+permission?.granted);
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

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      console.log("capturing");
      const photo = await cameraRef.current.takePictureAsync({
        quality: .1,
        base64: true,
      });

      setImageCaptured(true);
      // Process with GPT-4V
      console.log("sending photo");
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Using a thousand words, describe this photo as accurately as possible so that Dall-E may make a duplicate image that is as close as possible to the real image"
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
      });

      console.log("gpt 4o raw response: " + response.choices[0]?.message?.content);

      const imageDescription = response.choices[0]?.message?.content || '';
      console.log("gpt 4o response: " + imageDescription);

      setDescription(imageDescription);
      setShowDescription(true);
      setImageCaptured(false);
      // Generate image with DALL-E
      console.log("sending to dalle");
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: imageDescription,
        n: 1,
        size: "1024x1024",
      });

      const generatedImageUrl = imageResponse.data[0]?.url;
      console.log("dalle response: " + generatedImageUrl);
      if (generatedImageUrl) {
        setGeneratedImage(generatedImageUrl);
        setProcessingComplete(true);
      }
    } catch (error) {
      console.error('Failed to process image:', error);
    } finally {
      setCapturing(false);
    }
  };

  const handleBack = () => {
    setDescription('');
    setGeneratedImage('');
    setShowDescription(false);
    setProcessingComplete(false);
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
            <PolaroidView imageUri={generatedImage} description={description} onBack={handleBack} />
        );
      }else if(showDescription){
        return(
          <SafeAreaView style={styles.processingContainer}>
            {/*<LinearGradient colors={['#2D1B69', '#1E1B26']} style={styles.gradient} />*/}
            <View style={styles.descriptionContainer}>
              <TypingText text={description} isLoading={!processingComplete} onComplete={() => {
              }} />
            </View>
          </SafeAreaView>
        );
      }else if(imageCaptured) {
        return(
          <CameraView
            ref={cameraRef}
            style={styles.camera}
          >
            <SafeAreaView style={styles.processingContainer}>
              <View style={styles.descriptionContainer}>
                <Text style={styles.text}>
                  <Animated.Text>Loading</Animated.Text>
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
                    {/*<Animated.View style={[styles.gradientContainer, gradientStyle]}>*/}
                    <Animated.View>
                      <LinearGradient
                        colors={['#9C27B0', '#673AB7']}
                        style={styles.buttonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    </Animated.View>
                    <View style={styles.innerButton}>
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
  descriptionContainer: {
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
