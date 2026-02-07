import { fetch } from 'expo/fetch';
import { Image, Alert } from 'react-native';
import { OpenAI } from 'openai';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
  fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    return fetch(url, init as any);
  }) as any,
});

export const generateLocalDescription = async (
  photoUri: string,
): Promise<{ init: string; scanning: string; full: string }> => {
  try {
    console.log('generating local description');
    // Get image dimensions to understand composition
    const imageSize = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        Image.getSize(
          photoUri,
          (width, height) => resolve({ width, height }),
          reject,
        );
      },
    );

    // Generate description based on visible characteristics
    const aspectRatio = imageSize.width / imageSize.height;
    const isPortrait = imageSize.height > imageSize.width;
    const isSquare = Math.abs(aspectRatio - 1) < 0.1;

    const init = 'INITIATING COMPREHENSIVE VISUAL ANALYSIS PROTOCOL.';

    const scanning = `System is now scanning captured image data at resolution ${imageSize.width}x${imageSize.height} pixels configured in ${isSquare ? 'square' : isPortrait ? 'portrait' : 'landscape'} orientation format.

Beginning multi-stage photographic information extraction process to derive compositional parameters, spatial relationships, and complete visual characteristic mapping for high-fidelity reconstruction purposes. Processing luminance distribution patterns across all image sectors. Analyzing light source directionality and intensity gradients to determine natural illumination conditions present within both interior architectural spaces and exterior environmental contexts. Computing shadow falloff characteristics and highlight bloom patterns. Measuring ambient light contribution ratios and calculating direct versus indirect lighting proportions throughout the captured scene. Evaluating color temperature variance across spatial zones to map environmental lighting conditions with precision. Executing focal plane analysis algorithms to examine depth-of-field characteristics. Scanning bokeh patterns and edge sharpness gradients to identify subject-background separation through selective focus distribution mapping. Processing z-axis depth information encoded in blur kernel size variations. Calculating aperture simulation parameters based on observed focus falloff rates. Determining critical focus plane positioning and measuring depth of acceptable sharpness boundaries within the three-dimensional scene space. Sampling comprehensive color spectrum data across all image quadrants and pixel regions. Mapping multi-dimensional hue values, saturation intensity levels, and luminance brightness coefficients throughout the entire captured scene. Processing chromatic aberration patterns and color fringing characteristics. Analyzing color harmony relationships and complementary color distributions. Computing overall color palette temperature bias and evaluating color grading characteristics applied during capture. Identifying dominant color families and measuring their spatial distribution density across the compositional frame. Evaluating structural compositional framework to identify primary subject positioning within established frame boundaries. Computing rule-of-thirds alignment scores and analyzing golden ratio compositional adherence. Measuring spatial relationship vectors between foreground subject elements and contextual background components. Processing visual weight distribution across compositional quadrants. Analyzing leading lines, directional flow patterns, and visual hierarchy establishment within the framed scene. Calculating negative space utilization and examining figure-ground relationship dynamics. Measuring textural detail density coefficients across all visible surface regions. Processing fine-detail preservation levels and analyzing texture characteristic information for materials including fabric, skin, metal, wood, plastic, glass, and organic matter. Computing micro-contrast patterns and edge definition sharpness values. Evaluating surface roughness indices and reflectivity characteristics. Scanning for pattern repetition and textural rhythm elements throughout the compositional space. Interpreting aggregated photographic data as temporal documentation of real-world moment containing authentic illumination properties derived from natural or practical light sources. Processing indicates genuine chromatic variation consistent with environmental color cast and atmospheric perspective principles. Depth information suggests true three-dimensional spatial relationships captured through optical lens systems with realistic perspective compression or expansion characteristics. Analysis confirms presence of clearly defined primary subject occupying optimal compositional positioning with measured visual prominence. Surrounding supplementary background components provide environmental context data and scene establishment information necessary for complete spatial understanding. Atmospheric conditions, weather patterns, and time-of-day indicators processed from available metadata and visual cues embedded within pixel data. Reconstruction protocol parameters: Maintain strict adherence to ${isPortrait ? 'portrait' : isSquare ? 'square' : 'landscape'} aspect ratio configuration at specified dimensional requirements. Preserve all identified natural lighting quality parameters including measured color temperature values, shadow density coefficients, and highlight intensity ranges. Replicate exact subject positioning coordinates and framing specifications relative to primary focal point with sub-pixel accuracy. Include all processed background contextual elements with proper spatial scaling and perspective-correct placement. Match determined atmospheric mood characteristics including haze density, contrast ratios, and tonal distribution curves. Ensure authentic detail and texture mapping throughout all image regions maintaining original capture fidelity levels. Maintain proper depth separation between foreground and background spatial planes as measured in original three-dimensional capture with accurate focus gradient simulation.`;

    const full = `${init} ${scanning}`;

    return { init, scanning, full: full.substring(0, 3500) };
  } catch (error) {
    console.error('Local description generation failed:', error);
    const fallback =
      'A photograph with natural lighting, clear subject focus, supporting background context, authentic color palette, dimensional depth, and detailed textures meant for accurate visual reproduction.';
    return {
      init: 'INITIATING COMPREHENSIVE VISUAL ANALYSIS PROTOCOL.',
      scanning: fallback,
      full: fallback,
    };
  }
};

export const generateChatGPTDescription = async (
  photoBase64: string,
  signal?: AbortSignal,
): Promise<string> => {
  try {
    console.log('generating ChatGPT description');
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Using up to 4000 characters: describe this photo as accurately as possible so that DALL-E may make a duplicate image that is as close as possible to the real image. Include details about lighting, composition, colors, textures, and any visible objects or text. Focus on accuracy and completeness.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${photoBase64}`,
                },
              },
            ],
          },
        ],
        max_completion_tokens: 4096,
      },
      { signal },
    );

    const imageDescription = response.choices[0]?.message?.content || '';
    console.log('Token usage:', response.usage?.total_tokens);

    if (
      imageDescription.includes('unable to assist') ||
      imageDescription.includes('policy')
    ) {
      throw new Error(`Image content policy violation: ${imageDescription}`);
    }

    return imageDescription;
  } catch (error: any) {
    // Don't log error if request was aborted
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log('ChatGPT description generation aborted');
      return '';
    }
    console.error('ChatGPT description generation failed:', error);
    return '';
  }
};

export const generateImageWithStreaming = async (
  prompt: string,
  mode: string,
  signal: AbortSignal | undefined,
  onPartialImage: (imageUrl: string) => void,
): Promise<string> => {
  try {
    console.log('Starting streaming image generation');
    console.log('Prompt:', prompt);
    console.log('Camera mode:', mode);
    // Customize prompt based on camera mode
    let promptPrefix = '';
    switch (mode) {
      case 'cartoon':
        promptPrefix =
          'Create a vibrant cartoon illustration in a picture book style with bold outlines, bright colors, and whimsical character design based on this description: ';
        break;
      case '90s-disposable':
        promptPrefix =
          'Create a photograph with authentic 90s disposable camera aesthetics: soft focus, grainy film texture, light leaks, slightly overexposed highlights, warm color cast, vignetting, and that nostalgic lo-fi film quality. Based on this description: ';
        break;
      case 'super-ai':
        promptPrefix =
          'Create a hyper-realistic image with enhanced details, dynamic lighting, and vivid colors that amplify the visual impact while maintaining fidelity to the original scene. Based on this description: ';
        break;
      case 'realistic':
      default:
        promptPrefix =
          'Create an image that is as close as possible to this description: ';
        break;
    }

    console.log('Final prompt:', promptPrefix + prompt.substring(0, 3900));

    const stream = await openai.images.generate(
      {
        prompt: promptPrefix + prompt.substring(0, 3900),
        model: 'gpt-image-1.5',
        n: 1,
        stream: true,
        partial_images: 2,
      },
      { signal },
    );

    let finalImageB64 = '';
    let eventCount = 0;

    console.log('Starting to process stream events...');

    for await (const event of stream) {
      if (signal?.aborted) {
        console.log('Stream aborted by signal');
        break;
      }

      eventCount++;
      console.log('Event', eventCount, '- Type:', event.type);

      if (event.type === 'image_generation.partial_image') {
        const partialB64 = event.b64_json;
        if (partialB64) {
          console.log(
            'Received partial image, index:',
            event.partial_image_index,
            'b64 length:',
            partialB64.length,
          );
          onPartialImage(`data:image/png;base64,${partialB64}`);
        }
      } else if (event.type === 'image_generation.completed') {
        finalImageB64 = event.b64_json || '';
        console.log(
          'Image generation completed, b64 length:',
          finalImageB64.length,
        );
      }
    }

    console.log('Stream processing complete. Total events:', eventCount);

    return finalImageB64 ? `data:image/png;base64,${finalImageB64}` : '';
  } catch (error: any) {
    // Don't throw error if request was aborted
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log('Image generation aborted');
      return '';
    }
    console.error('Streaming image generation failed:', error);
    throw error;
  }
};

export const saveImageToGallery = async (
  uri: string,
  prefix: string,
  mediaPermission: MediaLibrary.PermissionResponse | null,
) => {
  try {
    if (!mediaPermission?.granted) {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Media library permission not granted');
        return;
      }
    }

    let fileUri = uri;

    // Handle data URIs (base64 encoded images)
    if (uri.startsWith('data:image')) {
      const filename = `${prefix}-${Date.now()}.png`;
      fileUri = `${FileSystem.documentDirectory}${filename}`;

      // Extract base64 data
      const base64Data = uri.split(',')[1];

      // Write base64 data to file
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`Saved data URI to ${fileUri}`);
    }
    // Handle remote URLs (starting with http/https)
    else if (uri.startsWith('http')) {
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
    console.error(`Failed to save ${prefix} image:`, error);
  }
};

export const savePolaroidImageToGallery = async (
  imageUri: string,
  mediaPermission: MediaLibrary.PermissionResponse | null,
): Promise<boolean> => {
  try {
    if (!mediaPermission?.granted) {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant permission to save images',
        );
        return false;
      }
    }

    // For remote URLs (starting with http/https), we need to download the file first
    if (imageUri.startsWith('http')) {
      const filename = `dalle-image-${Date.now()}.jpg`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      const downloadResult = await FileSystem.downloadAsync(imageUri, fileUri);

      if (downloadResult.status === 200) {
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        await MediaLibrary.createAlbumAsync('Thousand Words', asset, false);
        Alert.alert('Success', 'Image saved to Thousand Words album');
        return true;
      } else {
        Alert.alert('Error', 'Failed to download image');
        return false;
      }
    } else {
      // For local URIs, we can save directly
      const asset = await MediaLibrary.createAssetAsync(imageUri);
      await MediaLibrary.createAlbumAsync('Thousand Words', asset, false);
      Alert.alert('Success', 'Image saved to Thousand Words album');
      return true;
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to save image. Please try again.');
    console.error('Failed to save image:', error);
    return false;
  }
};
