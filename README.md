# Pixel to Genshin 3D Converter

Transform pixel art into Genshin Impact-style graphics and create fully textured 3D models using RunPod serverless infrastructure.

## Features

- **Style Conversion**: Transform pixel art to Genshin Impact cel-shading style
- **Weapon Removal**: Automatically detect and remove weapons from character sprites
- **T-Pose Generation**: Convert characters to T-pose for 3D modeling
- **3D Model Creation**: Generate textured 3D models using InstantMesh
- **Real-time Processing**: Track progress with live status updates

## RunPod Setup

### 1. Deploy the Serverless Endpoint

1. Clone this repository to your local machine
2. Navigate to the `runpod` directory
3. Create a new RunPod serverless endpoint:
   - Go to [RunPod Serverless](https://www.runpod.io/serverless)
   - Click "New Endpoint"
   - Choose "Custom" template
   - Upload the `runpod` directory as a zip file
   - Set minimum/maximum worker limits as needed
   - Deploy the endpoint

### 2. Build and Deploy

The Dockerfile will automatically:
- Install CUDA 12.1.1 and PyTorch
- Clone and setup InstantMesh repository
- Install all required dependencies
- Configure the handler for serverless execution

### 3. Get Your API Credentials

1. Copy your RunPod API key from the dashboard
2. Copy your endpoint URL (format: `https://api.runpod.ai/v2/ENDPOINT_ID/runsync`)

### 4. Configure the Application

1. Open the web application
2. Click "Configure API"
3. Enter your API key and endpoint URL
4. Click "Test Connection" to verify setup

## Usage

1. Upload a pixel art image (PNG, JPG, GIF)
2. Configure RunPod API credentials if not already done
3. Click "Start Processing" to begin the pipeline
4. Monitor progress through the processing steps
5. Download the generated images and 3D models

## Processing Pipeline

### Stage 1: Style & Pose Conversion
- Remove weapons using OWL-ViT and CLIPSeg
- Convert to T-pose using OpenPose ControlNet
- Apply Genshin Impact cel-shading style
- Generate clean lineart and smooth gradients

### Stage 2: 3D Model Generation
- Use processed image as input for InstantMesh
- Generate textured 3D model (.obj, .ply, .fbx formats)
- Apply automatic UV mapping and texturing

## Technical Stack

### Frontend
- React + TypeScript
- Tailwind CSS
- shadcn/ui components
- RunPod API integration

### Backend (RunPod)
- Python 3.x
- PyTorch + CUDA 12.1
- Stable Diffusion pipelines
- InstantMesh for 3D generation
- OpenPose, ControlNet
- REMBG for background removal

## API Endpoints

### Main Processing
```
POST https://api.runpod.ai/v2/ENDPOINT_ID/runsync
```

**Request Body:**
```json
{
  "input": {
    "image_url": "data:image/png;base64,...",
    "score_threshold": 0.20,
    "mask_dilate": 12,
    "tpose_scope": "upper_body",
    "guidance_scale": 7.5,
    "steps": 34,
    "controlnet_scales": [1.35, 0.5],
    "out_long_side": 1024,
    "pixel_preserve": false,
    "prompt": "Genshin Impact style, anime cel shading...",
    "negative_prompt": "weapon, gun, sword, pixelated..."
  }
}
```

### 3D Model Generation
```json
{
  "input": {
    "final_png": "https://...",
    "input_image": "https://...",
    "config": "configs/instant-mesh-large.yaml",
    "device": "cuda"
  }
}
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure all Python files are copied to the container
2. **CUDA Issues**: Verify GPU availability and CUDA version compatibility  
3. **API Connection Failed**: Check endpoint URL format and API key validity
4. **Processing Timeout**: Increase worker timeout or reduce image size

### Debug Mode

Enable debug mode by sending:
```json
{
  "input": {
    "debug_help": true
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with RunPod deployment
5. Submit a pull request

## License

This project is open source and available under the MIT License.