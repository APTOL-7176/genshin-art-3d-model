import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  AlertCircle 
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    {
      id: 'style-conversion',
      title: 'Style Conversion',
      description: 'Transform pixel art to Genshin Impact style',
      icon: Sparkles,
      status: 'pending'
    },
    {
      id: 'pose-conversion',
      title: 'T-Pose Generation',
      description: 'Convert character to T-pose',
      icon: Zap,
      status: 'pending'
    },
    {
      id: 'multi-view',
      title: 'Multi-View Generation',
      description: 'Create front, side, and back views',
      icon: ImageIcon,
      status: 'pending'
    },
    {
      id: '3d-model',
      title: '3D Model Creation',
      description: 'Generate textured 3D model',
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

    return response.json();
  };

  const waitForJobCompletion = async (jobId: string, maxAttempts = 60): Promise<any> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusResponse = await fetch(`${apiEndpoint}/status/${jobId}`, {
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
      
      // Step 1: Style Conversion to Genshin Impact style
      updateStepStatus('style-conversion', 'processing', 0);
      
      const imageBase64 = await convertImageToBase64(uploadedImage);
      
      const styleConversionPayload = {
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
          prompt: "Genshin Impact style, anime cel shading, smooth soft gradients, clean thin lineart, high quality, detailed face, no weapons, natural relaxed hands, strict T-pose, character centered, soft vibrant colors, white studio lighting",
          negative_prompt: "weapon, gun, sword, knife, rifle, spear, bow, axe, staff, grenade, bomb, pixelated, 8-bit, mosaic, dithering, voxel, lowres, jpeg artifacts, oversharp, deformed hands, extra fingers, missing fingers, text, watermark, harsh shadows, photorealistic"
        }
      };

      updateStepStatus('style-conversion', 'processing', 25);
      const styleResult = await callRunPodAPI(styleConversionPayload);
      
      updateStepStatus('style-conversion', 'processing', 50);
      const styleJobResult = await waitForJobCompletion(styleResult.id);
      
      updateStepStatus('style-conversion', 'processing', 90);
      
      // Extract the processed image URL from result
      const processedImageUrl = styleJobResult.output?.processed_image_url || styleJobResult.output?.image_url;
      
      if (!processedImageUrl) {
        throw new Error('No processed image received from style conversion');
      }

      updateStepStatus('style-conversion', 'completed');
      
      // Add generated Genshin-style image
      setGeneratedImages(prev => [...prev, {
        id: 'genshin-style',
        type: 'genshin',
        url: processedImageUrl,
        filename: 'genshin_style.png'
      }]);

      // Step 2: T-Pose Conversion (already included in the style conversion)
      updateStepStatus('pose-conversion', 'completed');

      // Step 3: Multi-View Generation
      updateStepStatus('multi-view', 'processing', 0);
      
      // Generate front, side, and back views using the processed image
      const viewPrompts = {
        front: "front view, facing camera, full body, T-pose, centered",
        side: "side view, profile, full body, T-pose, arms extended horizontally", 
        back: "back view, rear view, full body, T-pose, arms extended horizontally"
      };

      const viewResults = [];
      let viewProgress = 0;
      
      for (const [viewType, viewPrompt] of Object.entries(viewPrompts)) {
        const viewPayload = {
          input: {
            image_url: processedImageUrl,
            prompt: `${styleConversionPayload.input.prompt}, ${viewPrompt}`,
            negative_prompt: styleConversionPayload.input.negative_prompt,
            guidance_scale: 7.5,
            steps: 30,
            controlnet_scales: [1.2, 0.4]
          }
        };

        const viewResult = await callRunPodAPI(viewPayload);
        const viewJobResult = await waitForJobCompletion(viewResult.id);
        
        const viewImageUrl = viewJobResult.output?.processed_image_url || viewJobResult.output?.image_url;
        
        if (viewImageUrl) {
          viewResults.push({
            id: `${viewType}-view`,
            type: viewType as 'front' | 'side' | 'back',
            url: viewImageUrl,
            filename: `${viewType}_view.png`
          });
        }

        viewProgress += 33.33;
        updateStepStatus('multi-view', 'processing', Math.min(100, viewProgress));
      }
      
      updateStepStatus('multi-view', 'completed');
      
      // Add multi-view images
      setGeneratedImages(prev => [...prev, ...viewResults]);

      // Step 4: 3D Model Creation
      updateStepStatus('3d-model', 'processing', 0);
      
      const meshPayload = {
        input: {
          final_png: processedImageUrl,
          config: "configs/instant-mesh-large.yaml",
          device: "cuda"
        }
      };

      updateStepStatus('3d-model', 'processing', 25);
      const meshResult = await callRunPodAPI(meshPayload);
      
      updateStepStatus('3d-model', 'processing', 50);
      const meshJobResult = await waitForJobCompletion(meshResult.id);
      
      updateStepStatus('3d-model', 'processing', 90);
      
      // Check if 3D model was created successfully
      if (meshJobResult.output?.out_dir_listing?.some((file: string) => file.endsWith('.obj') || file.endsWith('.fbx'))) {
        updateStepStatus('3d-model', 'completed');
        toast.success('3D model generation completed successfully!');
      } else {
        updateStepStatus('3d-model', 'error');
        toast.error('3D model generation failed');
      }

      toast.success('All processing completed successfully!');
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
    setIsProcessing(false);
  };

  const download3DModel = async () => {
    try {
      // In a real implementation, this would get the 3D model file from the last processing result
      toast.info('3D model download would be implemented here with the actual model file from RunPod');
    } catch (error) {
      console.error('3D model download error:', error);
      toast.error('3D model download failed');
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
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>RunPod API Configuration</DialogTitle>
                  <DialogDescription>
                    Enter your RunPod API credentials to enable processing
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
                  <div className="flex gap-2">
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

        {/* Processing Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="genshin">Genshin Style</TabsTrigger>
                  <TabsTrigger value="front">Front View</TabsTrigger>
                  <TabsTrigger value="side">Side View</TabsTrigger>
                  <TabsTrigger value="back">Back View</TabsTrigger>
                </TabsList>
                
                {['genshin', 'front', 'side', 'back'].map(viewType => (
                  <TabsContent key={viewType} value={viewType} className="mt-6">
                    {generatedImages.find(img => img.type === viewType) ? (
                      <div className="space-y-4">
                        <img 
                          src={generatedImages.find(img => img.type === viewType)?.url}
                          alt={`${viewType} view`}
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
                              const image = generatedImages.find(img => img.type === viewType);
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
                        <p>No {viewType} view generated yet</p>
                      </div>
                    )}
                  </TabsContent>
                ))}
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
              </CardTitle>
              <CardDescription>
                Your 3D model has been generated and is ready for download
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <Button size="lg" className="gap-2" onClick={download3DModel}>
                  <Download className="w-5 h-5" />
                  Download 3D Model (.fbx)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default App;