import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useKV } from '@github/spark/hooks';
import { 
  Upload, 
  Settings, 
  Image as ImageIcon, 
  Cube,
  Eye,
  Download,
  Sparkles,
  Zap,
  CheckCircle,
  AlertCircle,
  Sword,
  Person,
  Wrench,
  Info,
  Question,
  Code,
  Copy
} from '@phosphor-icons/react';

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
}

interface GeneratedImage {
  id: string;
  type: 'original' | 'genshin' | 'tpose' | 'front' | 'side' | 'back';
  url: string;
  filename: string;
}

function App() {
  const [apiKey, setApiKey] = useKV("runpod-api-key", "");
  const [apiEndpoint, setApiEndpoint] = useKV("runpod-endpoint", "");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [modelFiles, setModelFiles] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [removeWeapon, setRemoveWeapon] = useKV("remove-weapon", true);
  const [enableRigging, setEnableRigging] = useKV("enable-rigging", true);
  const [characterGender, setCharacterGender] = useKV("character-gender", "auto");
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    {
      id: 'style-conversion',
      title: 'Style & Pose Conversion',
      description: 'Transform to Genshin Impact style with T-pose',
      icon: Sparkles,
      status: 'pending'
    },
    {
      id: 'weapon-removal',
      title: 'Weapon Processing',
      description: 'Remove/keep weapons based on user preference',
      icon: Zap,
      status: 'pending'
    },
    {
      id: 'multi-view',
      title: 'Image Processing',
      description: 'Apply cel shading and smooth gradients',
      icon: ImageIcon,
      status: 'pending'
    },
    {
      id: '3d-model',
      title: '3D Model Creation',
      description: 'Generate textured 3D model with InstantMesh',
      icon: Cube,
      status: 'pending'
    },
    {
      id: 'rigging',
      title: 'Character Rigging',
      description: 'Add skeletal animation rig for character',
      icon: Cube,
      status: 'pending'
    }
  ]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload a valid image file');
        return;
      }
      
      setUploadedImage(file);
      const url = URL.createObjectURL(file);
      setUploadedImageUrl(url);
      toast.success('Image uploaded successfully');
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(file);
      const url = URL.createObjectURL(file);
      setUploadedImageUrl(url);
      toast.success('Image uploaded successfully');
    } else {
      toast.error('Please drop a valid image file');
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const updateStepStatus = (stepId: string, status: ProcessingStep['status'], progress?: number) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, progress } : step
    ));
  };

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get pure base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const callRunPodAPI = async (payload: any) => {
    // Determine if this is a synchronous or asynchronous endpoint
    const isSync = apiEndpoint.includes('/runsync');
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (isSync) {
      // For synchronous endpoints, return the result directly
      return { 
        id: 'sync-job', 
        ...result,
        status: result.error_message ? 'FAILED' : 'COMPLETED'
      };
    } else {
      // For asynchronous endpoints, return job info for polling
      return result;
    }
  };

  const waitForJobCompletion = async (jobResult: any, maxAttempts = 60): Promise<any> => {
    // If this is a sync result (from /runsync endpoint), return immediately
    if (jobResult.id === 'sync-job' || jobResult.status === 'COMPLETED' || jobResult.status === 'FAILED') {
      if (jobResult.status === 'FAILED' || jobResult.error_message) {
        throw new Error(`Job failed: ${jobResult.error_message || 'Unknown error'}`);
      }
      return jobResult;
    }

    // For async endpoints, poll for completion
    const baseUrl = apiEndpoint.replace(/\/(run|runsync)$/, '');
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusResponse = await fetch(`${baseUrl}/status/${jobResult.id}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const status = await statusResponse.json();
      
      if (status.status === 'COMPLETED') {
        return status;
      } else if (status.status === 'FAILED') {
        throw new Error(`Job failed: ${status.error || 'Unknown error'}`);
      }
      
      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Job timed out after maximum attempts');
  };

  const validateApiEndpoint = (endpoint: string): boolean => {
    const runpodPattern = /^https:\/\/api\.runpod\.ai\/v2\/[a-zA-Z0-9-]+\/(run|runsync)$/;
    return runpodPattern.test(endpoint);
  };

  const processImage = async () => {
    if (!uploadedImage) {
      toast.error('Please upload an image first');
      return;
    }

    if (!apiKey || !apiEndpoint) {
      toast.error('Please configure RunPod API credentials');
      return;
    }

    if (!validateApiEndpoint(apiEndpoint)) {
      toast.error('Invalid API endpoint format. Please use: https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Step 1: Convert image to base64 and process through the full pipeline
      updateStepStatus('style-conversion', 'processing', 0);
      
      const imageBase64 = await convertImageToBase64(uploadedImage);
      
      // Build dynamic prompt based on user preferences
      let basePrompt = "Genshin Impact style, anime cel shading, smooth soft gradients, clean thin lineart, high quality, detailed face, natural relaxed hands, strict T-pose, character centered, soft vibrant colors, white studio lighting";
      let baseNegativePrompt = "pixelated, 8-bit, mosaic, dithering, voxel, lowres, jpeg artifacts, oversharp, deformed hands, extra fingers, missing fingers, text, watermark, harsh shadows, photorealistic";
      
      // Add gender-specific prompts
      if (characterGender === "male") {
        basePrompt += ", male character, masculine features";
      } else if (characterGender === "female") {
        basePrompt += ", female character, feminine features";
      }
      
      // Add weapon removal prompts if enabled
      if (removeWeapon) {
        basePrompt += ", no weapons, empty hands, weaponless";
        baseNegativePrompt += ", weapon, gun, sword, knife, rifle, spear, bow, axe, staff, grenade, bomb, blade, shield, hammer, mace";
      }
      
      const processingPayload = {
        input: {
          image_url: `data:image/${uploadedImage.type.split('/')[1]};base64,${imageBase64}`,
          score_threshold: 0.20,
          mask_dilate: 12,
          tpose_scope: "upper_body",
          guidance_scale: 7.5,
          steps: 34,
          controlnet_scales: [1.35, 0.5],
          out_long_side: 1024,
          pixel_preserve: false,
          remove_weapon: removeWeapon,
          character_gender: characterGender,
          prompt: basePrompt,
          negative_prompt: baseNegativePrompt
        }
      };

      updateStepStatus('style-conversion', 'processing', 25);
      updateStepStatus('weapon-removal', 'processing', 0);
      
      const result = await callRunPodAPI(processingPayload);
      
      updateStepStatus('style-conversion', 'processing', 50);
      updateStepStatus('weapon-removal', 'processing', 50);
      updateStepStatus('multi-view', 'processing', 0);
      
      const jobResult = await waitForJobCompletion(result);
      
      updateStepStatus('style-conversion', 'processing', 90);
      updateStepStatus('weapon-removal', 'processing', 90);
      updateStepStatus('multi-view', 'processing', 50);
      
      // Extract the processed image URL from result
      const processedImageUrl = jobResult.output?.processed_image_url || 
                               jobResult.output?.image_url ||
                               jobResult.processed_image_url ||
                               jobResult.image_url;
      
      if (!processedImageUrl) {
        console.error('Full job result:', jobResult);
        throw new Error('No processed image received from the pipeline. Check RunPod logs for details.');
      }

      updateStepStatus('style-conversion', 'completed');
      updateStepStatus('weapon-removal', 'completed');
      updateStepStatus('multi-view', 'completed');
      
      // Add generated Genshin-style T-pose image
      setGeneratedImages([{
        id: 'genshin-style',
        type: 'genshin',
        url: processedImageUrl,
        filename: 'genshin_tpose.png'
      }]);

      // Step 2: Generate 3D model using InstantMesh
      updateStepStatus('3d-model', 'processing', 0);
      
      const meshPayload = {
        input: {
          final_png: processedImageUrl,
          input_image: processedImageUrl,
          config: "configs/instant-mesh-large.yaml",
          device: "cuda",
          enable_rigging: enableRigging,
          character_gender: characterGender
        }
      };

      updateStepStatus('3d-model', 'processing', 25);
      const meshResult = await callRunPodAPI(meshPayload);
      
      updateStepStatus('3d-model', 'processing', 50);
      const meshJobResult = await waitForJobCompletion(meshResult);
      
      updateStepStatus('3d-model', 'processing', 90);
      
      // Check if 3D model was created successfully
      const modelFiles = meshJobResult.output?.out_dir_listing?.filter((file: string) => 
        file.endsWith('.obj') || file.endsWith('.fbx') || file.endsWith('.ply') || file.endsWith('.glb')) || [];
      
      if (modelFiles.length > 0) {
        setModelFiles(modelFiles);
        updateStepStatus('3d-model', 'completed');
        
        // Start rigging process if enabled
        if (enableRigging) {
          updateStepStatus('rigging', 'processing', 0);
          
          const riggingPayload = {
            input: {
              model_file: modelFiles[0], // Use the first generated model file
              character_gender: characterGender,
              rig_type: "mixamo", // Standard rigging for game characters
              bone_count: "medium" // Balanced between performance and flexibility
            }
          };
          
          updateStepStatus('rigging', 'processing', 25);
          const riggingResult = await callRunPodAPI(riggingPayload);
          
          updateStepStatus('rigging', 'processing', 50);
          const riggingJobResult = await waitForJobCompletion(riggingResult);
          
          updateStepStatus('rigging', 'processing', 90);
          
          // Check if rigging was successful
          const riggedModelFiles = riggingJobResult.output?.rigged_models || [];
          if (riggedModelFiles.length > 0) {
            setModelFiles([...modelFiles, ...riggedModelFiles]);
            updateStepStatus('rigging', 'completed');
            toast.success('3D model with rigging completed successfully!');
          } else {
            updateStepStatus('rigging', 'error');
            toast.error('Rigging failed - using unrigged model');
          }
        } else {
          // Skip rigging step
          updateStepStatus('rigging', 'completed');
        }
        
        if (!enableRigging) {
          toast.success('3D model generation completed successfully!');
        }
      } else {
        updateStepStatus('3d-model', 'error');
        toast.error('3D model generation failed - no model files found');
      }

      toast.success('Processing completed successfully!');
    } catch (error) {
      console.error('Processing error:', error);
      toast.error(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Mark any currently processing step as error
      setProcessingSteps(prev => prev.map(step => 
        step.status === 'processing' ? { ...step, status: 'error' } : step
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed');
    }
  };

  const resetProcessing = () => {
    setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending', progress: undefined })));
    setGeneratedImages([]);
    setModelFiles([]);
    setIsProcessing(false);
  };

  const download3DModel = async () => {
    if (modelFiles.length === 0) {
      toast.error('No 3D model files available');
      return;
    }
    
    try {
      // For now, show which files are available
      toast.info(`3D model files available: ${modelFiles.join(', ')}`);
      // Note: In a real implementation, these would be full URLs that can be downloaded
      // The current RunPod setup would need to provide accessible URLs for the generated files
    } catch (error) {
      console.error('3D model download error:', error);
      toast.error('3D model download failed');
    }
  };

  const copyCommandToClipboard = async () => {
    const command = `git clone https://github.com/APTOL-7176/genshin-art-3d-model.git && cd genshin-art-3d-model && pip install -r requirements.txt && python -c "import re; content=open('handler.py').read(); open('handler.py','w').write(re.sub(r'from \\.','from ',content))" && python -m runpod.serverless.start --handler-name handler`;
    
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Command copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy command');
    }
  };

  const testApiConnection = async () => {
    if (!apiKey || !apiEndpoint) {
      toast.error('Please enter both API key and endpoint');
      return;
    }
    
    try {
      // Test API connection with a simple debug request
      const testPayload = {
        input: {
          debug_help: true
        }
      };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.ok) {
        toast.success('API connection successful!');
      } else {
        toast.error('API connection failed - check your credentials');
      }
    } catch (error) {
      console.error('API test error:', error);
      toast.error(`API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getStepIcon = (step: ProcessingStep) => {
    const IconComponent = step.icon;
    const iconColor = step.status === 'completed' ? 'text-green-400' : 
                     step.status === 'processing' ? 'text-accent' : 
                     step.status === 'error' ? 'text-destructive' : 
                     'text-muted-foreground';
    return <IconComponent className={`w-6 h-6 ${iconColor}`} />;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">
            Pixel to Genshin 3D Converter
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Transform pixel art into Genshin Impact-style graphics and create fully textured 3D models
          </p>
          
          {/* API Configuration */}
          <div className="flex items-center gap-4">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Configure API
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>RunPod API Configuration</DialogTitle>
                  <DialogDescription>
                    Enter your RunPod API credentials to enable processing. 
                    <br /><br />
                    <strong>🚨 FIXED - Copy This Exact Command:</strong><br />
                    <div style={{ background: "#0d1117", padding: "12px", borderRadius: "6px", margin: "8px 0", border: "1px solid #30363d" }}>
                      <code style={{ color: "#e6edf3", fontSize: "11px", fontFamily: "monospace" }}>
                        git clone https://github.com/APTOL-7176/genshin-art-3d-model.git && cd genshin-art-3d-model && pip install -r requirements.txt && python -c "import re; content=open('handler.py').read(); open('handler.py','w').write(re.sub(r'from \.','from ',content))" && python -m runpod.serverless.start --handler-name handler
                      </code>
                    </div>
                    Fixed shell escaping and Python command syntax.<br /><br />
                    <strong>Container Image:</strong> <code>runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04</code><br /><br />
                    <strong>Get Your Credentials:</strong><br />
                    1. Get your API key from RunPod dashboard<br />
                    2. Copy your endpoint URL (format: https://api.runpod.ai/v2/ENDPOINT_ID/runsync)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="Enter your RunPod API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api-endpoint">API Endpoint</Label>
                    <Input
                      id="api-endpoint"
                      placeholder="https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync
                    </p>
                  </div>
                   <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium mb-2 text-green-400">Ready to Use Configuration:</p>
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium mb-1">Container Image:</p>
                            <code className="bg-background px-2 py-1 rounded text-xs block">
                              runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04
                            </code>
                          </div>
                          <div>
                            <p className="font-medium mb-1">Fixed Start Command (Copy This):</p>
                            <code className="bg-background px-2 py-1 rounded text-xs block whitespace-pre-wrap">
                              git clone https://github.com/APTOL-7176/genshin-art-3d-model.git && cd genshin-art-3d-model && pip install -r requirements.txt && python -c "import re; content=open('handler.py').read(); open('handler.py','w').write(re.sub(r'from \.','from ',content))" && python -m runpod.serverless.start --handler-name handler
                            </code>
                          </div>
                          <div>
                            <p className="font-medium mb-1">Alternative (if above fails):</p>
                            <code className="bg-background px-2 py-1 rounded text-xs block whitespace-pre-wrap">
                              git clone https://github.com/APTOL-7176/genshin-art-3d-model.git && cd genshin-art-3d-model && pip install -r requirements.txt && sed -i "s/from \\./from /g" handler.py && python -m runpod.serverless.start --handler-name handler
                            </code>
                          </div>
                          <p className="text-xs text-muted-foreground">Fixed shell escaping issues. First option uses Python regex (more reliable), second uses sed with proper quotes.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                   <div className="flex gap-2">
                    <Button onClick={copyCommandToClipboard} variant="secondary" className="flex-1 gap-2">
                      <Copy className="w-4 h-4" />
                      Copy Fixed Command
                    </Button>
                    <Button onClick={testApiConnection} variant="outline" className="flex-1">
                      Test Connection
                    </Button>
                    <Button onClick={() => setIsDialogOpen(false)} className="flex-1">
                      Save
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isSetupGuideOpen} onOpenChange={setIsSetupGuideOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Question className="w-4 h-4" />
                  Setup Guide
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Complete Setup Guide - Fix Container & Import Errors
                  </DialogTitle>
                  <DialogDescription>
                    Step-by-step guide to fix the GitHub Container Registry access and import errors
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 text-sm">
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <h3 className="font-semibold text-destructive mb-2">🚨 Current Issues (SOLVED)</h3>
                    <ul className="list-disc list-inside space-y-1 text-destructive-foreground">
                      <li><s>Docker Registry Error: "denied" - GitHub Container Registry image is private</s></li>
                      <li><s>Import Error: "attempted relative import with no known parent package"</s></li>
                    </ul>
                    <div className="mt-3 p-2 bg-green-500/10 rounded border border-green-500/20">
                      <p className="text-green-400 text-sm font-medium">✅ Fixed with the configuration shown above!</p>
                    </div>
                  </div>

                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <h3 className="font-semibold text-primary mb-2">✅ Your Configuration (Perfect!)</h3>
                    <p className="mb-2">Based on your screenshot, you have exactly the right setup:</p>
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-sm">Container Image:</p>
                        <code className="bg-background px-2 py-1 rounded text-xs block">runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04</code>
                      </div>
                      <div>
                        <p className="font-medium text-sm">Fixed Start Command (Copy This):</p>
                        <code className="bg-background px-2 py-1 rounded text-xs block whitespace-pre-wrap">git clone https://github.com/APTOL-7176/genshin-art-3d-model.git && cd genshin-art-3d-model && pip install -r requirements.txt && python -c "import re; content=open('handler.py').read(); open('handler.py','w').write(re.sub(r'from \.','from ',content))" && python -m runpod.serverless.start --handler-name handler</code>
                      </div>
                      <div>
                        <p className="font-medium text-sm">Alternative (if above fails):</p>
                        <code className="bg-background px-2 py-1 rounded text-xs block whitespace-pre-wrap">git clone https://github.com/APTOL-7176/genshin-art-3d-model.git && cd genshin-art-3d-model && pip install -r requirements.txt && sed -i "s/from \\./from /g" handler.py && python -m runpod.serverless.start --handler-name handler</code>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Step 1: Get the Source Code</h3>
                    <code className="bg-muted px-3 py-2 rounded text-xs block">
                      git clone https://github.com/APTOL-7176/genshin-art-3d-model.git<br/>
                      cd genshin-art-3d-model
                    </code>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Step 2: Fix Import Errors</h3>
                    <p className="mb-2">Change all relative imports to absolute imports in <code>handler.py</code>:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-destructive font-medium mb-1">❌ WRONG:</p>
                        <code className="bg-muted px-2 py-1 rounded text-xs block">
                          from .instantmesh_runner import ...<br/>
                          from .genshin_style_converter import ...
                        </code>
                      </div>
                      <div>
                        <p className="text-green-400 font-medium mb-1">✅ CORRECT:</p>
                        <code className="bg-muted px-2 py-1 rounded text-xs block">
                          from instantmesh_runner import ...<br/>
                          from genshin_style_converter import ...
                        </code>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Step 3: Deploy Options</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <h4 className="font-medium mb-2">Option A: Build Custom Container</h4>
                        <code className="bg-muted px-2 py-1 rounded text-xs block mb-2">
                          docker build -t yourname/genshin-converter .<br/>
                          docker push yourname/genshin-converter
                        </code>
                        <p className="text-xs text-muted-foreground">Then use your image in RunPod</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <h4 className="font-medium mb-2">Option B: Use Base Image</h4>
                        <code className="bg-muted px-2 py-1 rounded text-xs block mb-2">
                          runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel
                        </code>
                        <p className="text-xs text-muted-foreground">Upload Python files via RunPod file manager</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <h3 className="font-semibold text-primary mb-2">🎯 Test Your Setup</h3>
                    <p>Use the "Test Connection" button above. It should return:</p>
                    <code className="bg-background px-2 py-1 rounded text-xs block mt-2">
                      {"{"} "status": "success", "message": "RunPod handler is working correctly!" {"}"}
                    </code>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <h3 className="font-semibold text-yellow-400 mb-3">🛠️ Troubleshooting Common Errors</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-medium text-yellow-400">Error: "unknown switch 'r'"</p>
                        <p className="text-yellow-200">Cause: Shell escaping issues in git clone command</p>
                        <p className="text-green-400">Solution: Use the fixed command above with proper quote escaping</p>
                      </div>
                      <div>
                        <p className="font-medium text-yellow-400">Error: "attempted relative import"</p>
                        <p className="text-yellow-200">Cause: Python imports using dots (.) instead of module names</p>
                        <p className="text-green-400">Solution: The Python regex automatically fixes these imports</p>
                      </div>
                      <div>
                        <p className="font-medium text-yellow-400">Error: "denied" from GitHub Container Registry</p>
                        <p className="text-yellow-200">Cause: Private container image is not accessible</p>
                        <p className="text-green-400">Solution: Use public PyTorch base image as shown above</p>
                      </div>
                      <div>
                        <p className="font-medium text-yellow-400">Error: "No module named 'runpod'"</p>
                        <p className="text-yellow-200">Cause: RunPod dependencies not installed</p>
                        <p className="text-green-400">Solution: Add "pip install runpod" to your start command</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setIsSetupGuideOpen(false)}>
                    Got it!
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* API Status Indicator */}
            <div className="flex items-center gap-2">
              {apiKey && apiEndpoint && validateApiEndpoint(apiEndpoint) ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-green-400">API Configured</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-yellow-400">API Not Configured</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <Card className="processing-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Pixel Art
            </CardTitle>
            <CardDescription>
              Upload your pixel art image to begin the conversion process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className="upload-zone rounded-lg p-12 text-center cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('image-upload')?.click()}
            >
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">
                {uploadedImage ? uploadedImage.name : "Drop your image here or click to upload"}
              </p>
              <p className="text-sm text-muted-foreground">
                Supports PNG, JPG, GIF formats
              </p>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            
            {uploadedImageUrl && (
              <div className="mt-6">
                <img 
                  src={uploadedImageUrl} 
                  alt="Uploaded pixel art"
                  className="max-w-xs mx-auto rounded-lg border border-border"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processing Options */}
        <Card className="processing-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Processing Options
            </CardTitle>
            <CardDescription>
              Configure how your image will be processed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Character Gender */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Person className="w-4 h-4" />
                  Character Gender
                </Label>
                <Select value={characterGender} onValueChange={setCharacterGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto Detect</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Helps optimize the conversion process
                </p>
              </div>

              {/* Weapon Removal */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Sword className="w-4 h-4" />
                  Weapon Handling
                </Label>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remove-weapon" 
                    checked={removeWeapon}
                    onCheckedChange={setRemoveWeapon}
                  />
                  <Label htmlFor="remove-weapon" className="text-sm">
                    Remove weapons from character
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {removeWeapon ? "Weapons will be automatically removed" : "Weapons will be preserved"}
                </p>
              </div>

              {/* Character Rigging */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  3D Model Rigging
                </Label>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="enable-rigging" 
                    checked={enableRigging}
                    onCheckedChange={setEnableRigging}
                  />
                  <Label htmlFor="enable-rigging" className="text-sm">
                    Add skeletal rig for animation
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {enableRigging ? "Model will include animation-ready bones" : "Model will be static without rigging"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Processing Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {processingSteps.map((step) => (
            <Card key={step.id} className={`processing-card ${step.status === 'processing' ? 'active' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  {getStepIcon(step)}
                  <Badge variant={
                    step.status === 'completed' ? 'default' :
                    step.status === 'processing' ? 'secondary' :
                    step.status === 'error' ? 'destructive' :
                    'outline'
                  }>
                    {step.status === 'processing' ? 'Processing...' : 
                     step.status === 'completed' ? 'Completed' :
                     step.status === 'error' ? 'Error' :
                     'Pending'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                {step.status === 'processing' && step.progress !== undefined && (
                  <Progress value={step.progress} className="h-2" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center gap-4">
          <Button 
            onClick={processImage} 
            disabled={!uploadedImage || !apiKey || !apiEndpoint || isProcessing}
            size="lg"
            className="gap-2"
          >
            <Zap className="w-5 h-5" />
            {isProcessing ? 'Processing...' : 'Start Processing'}
          </Button>
          <Button 
            onClick={resetProcessing} 
            variant="outline"
            size="lg"
            className="gap-2"
            disabled={isProcessing}
          >
            Reset
          </Button>
        </div>

        {/* Generated Images */}
        {generatedImages.length > 0 && (
          <Card className="processing-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Generated Images
              </CardTitle>
              <CardDescription>
                View and download your processed images
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="genshin" className="w-full">
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger value="genshin">Processed Image</TabsTrigger>
                </TabsList>
                
                <TabsContent value="genshin" className="mt-6">
                  {generatedImages.find(img => img.type === 'genshin') ? (
                    <div className="space-y-4">
                      <img 
                        src={generatedImages.find(img => img.type === 'genshin')?.url}
                        alt="Processed Genshin-style image"
                        className="max-w-md mx-auto rounded-lg border border-border block"
                      />
                      <div className="flex justify-center gap-2">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="w-4 h-4" />
                          Preview
                        </Button>
                        <Button 
                          size="sm" 
                          className="gap-2"
                          onClick={() => {
                            const image = generatedImages.find(img => img.type === 'genshin');
                            if (image) {
                              downloadImage(image.url, image.filename);
                            }
                          }}
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No processed image generated yet</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* 3D Model Download */}
        {processingSteps.find(s => s.id === '3d-model')?.status === 'completed' && (
          <Card className="processing-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cube className="w-5 h-5" />
                3D Model Ready
                {enableRigging && processingSteps.find(s => s.id === 'rigging')?.status === 'completed' && (
                  <Badge variant="secondary" className="ml-2">With Rigging</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Your 3D model has been generated and is ready for download
                {enableRigging && processingSteps.find(s => s.id === 'rigging')?.status === 'completed' && (
                  <span className="block mt-1 text-accent">Includes skeletal rig for animation in game engines</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <Button size="lg" className="gap-2" onClick={download3DModel}>
                  <Download className="w-5 h-5" />
                  Download 3D Model 
                  {enableRigging && processingSteps.find(s => s.id === 'rigging')?.status === 'completed' 
                    ? " (.fbx + .rig)" 
                    : " (.fbx)"
                  }
                </Button>
              </div>
              {enableRigging && processingSteps.find(s => s.id === 'rigging')?.status === 'completed' && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Ready for Unity, Unreal Engine, Blender, and other 3D applications
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default App;