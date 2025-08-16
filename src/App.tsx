import React from 'react';
import { useState } from 'react';
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

  const simulateProcessing = async () => {
    if (!uploadedImage) {
      toast.error('Please upload an image first');
      return;
    }

    if (!apiKey || !apiEndpoint) {
      toast.error('Please configure RunPod API credentials');
      return;
    }

    try {
      // Style Conversion
      updateStepStatus('style-conversion', 'processing', 0);
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        updateStepStatus('style-conversion', 'processing', i);
      }
      updateStepStatus('style-conversion', 'completed');
      
      // Add generated Genshin-style image (simulated)
      setGeneratedImages(prev => [...prev, {
        id: 'genshin-style',
        type: 'genshin',
        url: uploadedImageUrl, // In real app, this would be the processed image
        filename: 'genshin_style.png'
      }]);

      // T-Pose Conversion
      updateStepStatus('pose-conversion', 'processing', 0);
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 300));
        updateStepStatus('pose-conversion', 'processing', i);
      }
      updateStepStatus('pose-conversion', 'completed');

      // Multi-View Generation
      updateStepStatus('multi-view', 'processing', 0);
      for (let i = 0; i <= 100; i += 25) {
        await new Promise(resolve => setTimeout(resolve, 400));
        updateStepStatus('multi-view', 'processing', i);
      }
      updateStepStatus('multi-view', 'completed');
      
      // Add multi-view images (simulated)
      const views = ['front', 'side', 'back'] as const;
      views.forEach(view => {
        setGeneratedImages(prev => [...prev, {
          id: `${view}-view`,
          type: view,
          url: uploadedImageUrl,
          filename: `${view}_view.png`
        }]);
      });

      // 3D Model Creation
      updateStepStatus('3d-model', 'processing', 0);
      for (let i = 0; i <= 100; i += 15) {
        await new Promise(resolve => setTimeout(resolve, 500));
        updateStepStatus('3d-model', 'processing', i);
      }
      updateStepStatus('3d-model', 'completed');

      toast.success('Processing completed successfully!');
    } catch (error) {
      toast.error('Processing failed. Please try again.');
      console.error('Processing error:', error);
    }
  };

  const resetProcessing = () => {
    setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending', progress: undefined })));
    setGeneratedImages([]);
  };

  const testApiConnection = async () => {
    if (!apiKey || !apiEndpoint) {
      toast.error('Please enter both API key and endpoint');
      return;
    }
    
    // Simulate API connection test
    toast.success('API connection successful!');
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
                    placeholder="https://api.runpod.ai/v2/..."
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                  />
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
            onClick={simulateProcessing} 
            disabled={!uploadedImage || !apiKey || !apiEndpoint}
            size="lg"
            className="gap-2"
          >
            <Zap className="w-5 h-5" />
            Start Processing
          </Button>
          <Button 
            onClick={resetProcessing} 
            variant="outline"
            size="lg"
            className="gap-2"
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
                          <Button size="sm" className="gap-2">
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
                <Button size="lg" className="gap-2">
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