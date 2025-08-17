/**
 * Advanced Image Processing Service
 * Handles client-side image processing and RunPod API communication
 */

export interface ProcessingConfig {
  score_threshold?: number;
  mask_dilate?: number;
  tpose_scope?: 'full_body' | 'upper_body';
  guidance_scale?: number;
  steps?: number;
  controlnet_scales?: number[];
  out_long_side?: number;
  remove_weapon?: boolean;
  character_gender?: 'auto' | 'male' | 'female';
  prompt?: string;
  negative_prompt?: string;
  enable_highres_fix?: boolean;
  highres_scale?: number;
  cfg_rescale?: number;
  eta?: number;
  sampler?: string;
}

export interface ProcessingResult {
  status: 'SUCCESS' | 'ERROR';
  processed_image_url?: string;
  error?: string;
  handler_version?: string;
  config_used?: ProcessingConfig;
  processing_time?: number;
  gpu_used?: string;
}

export class ImageProcessor {
  private apiKey: string = '';
  private apiEndpoint: string = '';

  setCredentials(apiKey: string, endpoint: string) {
    this.apiKey = apiKey;
    this.apiEndpoint = endpoint;
  }

  /**
   * Convert File to base64 string for API transmission
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1]; // Remove data URL prefix
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Apply Genshin Impact style processing locally as fallback
   */
  private async applyGenshinStyleLocal(imageFile: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Set canvas size with max 1024px
        const maxSize = 1024;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Apply Genshin Impact style processing
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Cel shading effect - posterize colors
          const levels = 6;
          const factor = 255 / levels;
          
          data[i] = Math.round(r / factor) * factor;     // Red
          data[i + 1] = Math.round(g / factor) * factor; // Green
          data[i + 2] = Math.round(b / factor) * factor; // Blue
          
          // Enhance vibrance for anime style
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const diff = max - min;
          
          if (diff > 30) {
            const enhancement = 1.4;
            const centerShift = 128;
            data[i] = Math.min(255, Math.max(0, (data[i] - centerShift) * enhancement + centerShift));
            data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - centerShift) * enhancement + centerShift));
            data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - centerShift) * enhancement + centerShift));
          }
        }
        
        // Apply processed image data back to canvas
        ctx.putImageData(imageData, 0, 0);
        
        // Add outline effect for anime style
        ctx.globalCompositeOperation = 'multiply';
        ctx.filter = 'contrast(1.3) saturate(1.6) brightness(1.1)';
        ctx.drawImage(canvas, 0, 0);
        
        // Reset composite operation
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        
        // Convert to data URL
        const processedUrl = canvas.toDataURL('image/png');
        resolve(processedUrl);
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image for processing'));
      };
      
      // Load the uploaded image
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      };
      reader.readAsDataURL(imageFile);
    });
  }

  /**
   * Process image using RunPod API with GPU acceleration
   */
  async processImage(imageFile: File, config: ProcessingConfig = {}): Promise<ProcessingResult> {
    try {
      console.log('🎮 Starting GPU-accelerated image processing...');
      
      // Convert image to base64
      const imageBase64 = await this.fileToBase64(imageFile);
      
      // Build optimized prompt for high-quality processing
      const basePrompt = config.prompt || 
        "Genshin Impact style, anime cel shading, ultra smooth gradients, pristine clean lineart, " +
        "masterpiece quality, ultra detailed face and eyes, perfect natural hands, strict T-pose anatomy, " +
        "character perfectly centered, rich vibrant colors, professional studio lighting, 8K resolution, " +
        "photorealistic textures with anime style";
      
      let negativePrompt = config.negative_prompt || 
        "pixelated, 8-bit, mosaic, dithering, voxel, lowres, jpeg artifacts, oversharp, deformed hands, " +
        "extra fingers, missing fingers, text, watermark, harsh shadows, photorealistic, blurry, low quality, " +
        "noise, grain, compression artifacts, bad anatomy, distorted proportions, asymmetrical features";

      // Add gender-specific prompts
      let enhancedPrompt = basePrompt;
      if (config.character_gender === "male") {
        enhancedPrompt += ", male character, masculine features";
      } else if (config.character_gender === "female") {
        enhancedPrompt += ", female character, feminine features";
      }

      // Add weapon removal prompts if enabled
      if (config.remove_weapon) {
        enhancedPrompt += ", no weapons, empty hands, weaponless";
        negativePrompt += ", weapon, gun, sword, knife, rifle, spear, bow, axe, staff, grenade, bomb, blade, shield, hammer, mace";
      }

      // Prepare REAL AI processing payload for actual Genshin conversion
      const processingPayload = {
        input: {
          action: "process_image",  // Use the actual AI action from our handler
          image_data: imageBase64,
          image_format: imageFile.type.split('/')[1],
          config: {
            score_threshold: config.score_threshold || 0.15,
            mask_dilate: config.mask_dilate || 16,
            tpose_scope: config.tpose_scope || "full_body",
            guidance_scale: config.guidance_scale || 12.5,
            steps: config.steps || 75,
            controlnet_scales: config.controlnet_scales || [1.8, 0.8],
            out_long_side: config.out_long_side || 2048,
            remove_weapon: config.remove_weapon || false,
            character_gender: config.character_gender || "auto",
            prompt: enhancedPrompt,
            negative_prompt: negativePrompt,
            // Ultra high-quality settings for high-end hardware
            enable_highres_fix: config.enable_highres_fix || true,
            highres_scale: config.highres_scale || 2.0,
            batch_size: 1,
            cfg_rescale: config.cfg_rescale || 0.7,
            eta: config.eta || 0.0,
            sampler: config.sampler || "DPM++ 2M Karras"
          }
        }
      };

      console.log('🚀 Calling RunPod API with ultra high-quality settings...');
      
      // Call RunPod API
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processingPayload)
      });

      if (!response.ok) {
        throw new Error(`RunPod API call failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📊 RunPod API response:', result);

      // Handle response based on endpoint type
      const isSync = this.apiEndpoint.includes('/runsync');
      let finalResult = result;

      if (!isSync && result.id) {
        // For async endpoints, poll for completion
        finalResult = await this.waitForJobCompletion(result);
      }

      // Extract processed image URL
      let processedImageUrl = null;
      if (finalResult.output) {
        processedImageUrl = finalResult.output.processed_image_url || 
                           finalResult.output.image_url ||
                           finalResult.output.result_url;
      }

      if (!processedImageUrl) {
        processedImageUrl = finalResult.processed_image_url ||
                           finalResult.image_url ||
                           finalResult.result_url;
      }

      // Check if we got a REAL AI processing result (not test handler)
      const isRealAI = finalResult.handler_version?.includes('REAL_AI') ||
                      finalResult.output?.gpu_used ||
                      finalResult.gpu_used ||
                      (finalResult.output?.message && finalResult.output.message.includes('GPU')) ||
                      (finalResult.message && finalResult.message.includes('GPU 가속'));

      if (!processedImageUrl) {
        if (isRealAI) {
          throw new Error('🎮 Real AI handler responded but no processed image found - check GPU memory, AI model loading, or prompt format');
        } else {
          console.log('⚠️ Test/BULLETPROOF handler detected - need to upload REAL AI handler for actual Genshin conversion');
          
          // Don't fallback immediately - try to get the bulletproof response if available
          if (finalResult.status === 'SUCCESS' && finalResult.output) {
            console.log('✅ Handler working but using test mode - upload "완성된 실제 AI Handler" for real processing');
          }
          
          // Fallback to enhanced local processing
          const localResult = await this.applyGenshinStyleLocal(imageFile);
          return {
            status: 'SUCCESS',
            processed_image_url: localResult,
            handler_version: 'LOCAL_ENHANCED_v2.0',
            config_used: config,
            processing_time: 0,
            error: '⚠️ Using enhanced local processing - Upload REAL AI Handler to RunPod for GPU-accelerated Genshin conversion'
          };
        }
      }

      return {
        status: finalResult.status || 'SUCCESS',
        processed_image_url: processedImageUrl,
        handler_version: finalResult.handler_version,
        config_used: config,
        processing_time: finalResult.processing_time || 0,
        gpu_used: finalResult.output?.gpu_used || finalResult.gpu_used
      };

    } catch (error) {
      console.error('❌ Image processing error:', error);
      
      // Fallback to local processing on API errors
      try {
        console.log('🔄 Falling back to local processing...');
        const localResult = await this.applyGenshinStyleLocal(imageFile);
        
        return {
          status: 'SUCCESS',
          processed_image_url: localResult,
          handler_version: 'LOCAL_FALLBACK_v1.0',
          error: `API Error: ${error instanceof Error ? error.message : 'Unknown error'} - Used local processing`,
          config_used: config
        };
      } catch (localError) {
        return {
          status: 'ERROR',
          error: `Both API and local processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          config_used: config
        };
      }
    }
  }

  /**
   * Wait for async job completion
   */
  private async waitForJobCompletion(jobResult: any, maxAttempts: number = 60): Promise<any> {
    const baseUrl = this.apiEndpoint.replace(/\/(run|runsync)$/, '');
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusResponse = await fetch(`${baseUrl}/status/${jobResult.id}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const status = await statusResponse.json();
      
      if (status.status === 'COMPLETED' || status.status === 'SUCCESS') {
        return status;
      } else if (status.status === 'FAILED') {
        throw new Error(`Job failed: ${status.error || 'Unknown error'}`);
      }
      
      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Job timed out after maximum attempts');
  }
}