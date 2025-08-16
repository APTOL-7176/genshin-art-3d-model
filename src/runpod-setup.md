# RunPod Container Setup Guide - COMPLETE FIX

## The Errors You're Seeing

1. **Docker Registry Error**: `denied` - The GitHub Container Registry image is not publicly accessible
2. **Import Error**: `ImportError: attempted relative import with no known parent package` - Python handler has incorrect imports

## SOLUTION: Build Your Own Container

Since the GitHub Container Registry image is private, you need to build and deploy your own container.

### Step 1: Get the Source Code

```bash
git clone https://github.com/APTOL-7176/genshin-art-3d-model.git
cd genshin-art-3d-model
```

### Step 2: Fix the Import Errors

The main issue is in the handler.py file. Here's what needs to be fixed:

#### Current problematic code:
```python
from .instantmesh_runner import (
    InstantMeshRunner,
    process_image_pipeline
)
```

#### Fixed code:
```python
from instantmesh_runner import (
    InstantMeshRunner,
    process_image_pipeline
)
```

### Step 3: Create/Fix the Handler File

Create a `handler.py` file with proper absolute imports:

```python
import runpod
import base64
import io
import os
import json
import tempfile
from PIL import Image
from typing import Dict, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FIXED: Use absolute imports (remove dots)
try:
    from instantmesh_runner import InstantMeshRunner, process_image_pipeline
    from genshin_style_converter import GenshinStyleConverter
    from weapon_remover import WeaponRemover
    from character_rigger import CharacterRigger
except ImportError as e:
    logger.error(f"Import error: {e}")
    # Fallback imports if modules are in subdirectories
    import sys
    sys.path.append('/app')
    sys.path.append('/app/src')
    try:
        from instantmesh_runner import InstantMeshRunner, process_image_pipeline
        from genshin_style_converter import GenshinStyleConverter
        from weapon_remover import WeaponRemover
        from character_rigger import CharacterRigger
    except ImportError as fallback_error:
        logger.error(f"Fallback import also failed: {fallback_error}")

def handler(job):
    """
    Main handler function for RunPod serverless endpoint
    Processes pixel art through Genshin Impact style conversion and 3D model generation
    """
    try:
        job_input = job.get('input', {})
        logger.info(f"Received job input: {job_input}")
        
        # Handle debug requests
        if job_input.get('debug_help'):
            return {
                "status": "success", 
                "message": "RunPod handler is working correctly!",
                "available_functions": [
                    "pixel_to_genshin_conversion",
                    "weapon_removal", 
                    "character_rigging",
                    "3d_model_generation"
                ]
            }
        
        # Extract parameters
        image_url = job_input.get('image_url')
        remove_weapon = job_input.get('remove_weapon', True)
        character_gender = job_input.get('character_gender', 'auto')
        enable_rigging = job_input.get('enable_rigging', True)
        
        # Validate required inputs
        if not image_url:
            return {"error": "No image_url provided", "status": "failed"}
        
        # Process the image through the complete pipeline
        logger.info("Starting image processing pipeline...")
        
        result = process_image_pipeline(
            image_url=image_url,
            remove_weapon=remove_weapon,
            character_gender=character_gender,
            enable_rigging=enable_rigging,
            **job_input
        )
        
        logger.info("Processing completed successfully")
        return {"status": "success", "output": result}
        
    except Exception as e:
        logger.error(f"Handler error: {str(e)}", exc_info=True)
        return {"error": str(e), "status": "failed"}

# Start the serverless function
if __name__ == "__main__":
    logger.info("Starting RunPod serverless handler...")
    runpod.serverless.start({"handler": handler})
```

### Step 4: Create Dockerfile

Create a `Dockerfile` in the repository root:

```dockerfile
# Use RunPod's PyTorch base image
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    ffmpeg \
    libsm6 \
    libxext6 \
    libfontconfig1 \
    libxrender1 \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install additional dependencies for 3D processing
RUN pip install --no-cache-dir \
    trimesh \
    pymeshlab \
    open3d \
    runpod

# Copy all application code
COPY . .

# Make sure Python can find all modules
ENV PYTHONPATH="/app:$PYTHONPATH"

# Set the handler as the entry point
CMD ["python", "handler.py"]
```

### Step 5: Create Requirements.txt

```txt
torch>=2.0.0
torchvision>=0.15.0
diffusers>=0.21.0
transformers>=4.25.0
controlnet-aux>=0.4.0
pillow>=9.0.0
numpy>=1.21.0
opencv-python>=4.5.0
gradio>=4.0.0
runpod>=1.5.0
trimesh>=3.15.0
pymeshlab>=2022.2
open3d>=0.17.0
accelerate>=0.20.0
xformers>=0.0.20
```

### Step 6: Build and Push Your Container

```bash
# Build the Docker image
docker build -t your-dockerhub-username/genshin-converter:latest .

# Push to Docker Hub (or any registry you prefer)
docker push your-dockerhub-username/genshin-converter:latest
```

### Step 7: Deploy on RunPod

1. Go to RunPod Serverless
2. Create a new endpoint
3. Set Container Image to: `your-dockerhub-username/genshin-converter:latest`
4. Set Container Disk to at least 20GB
5. Set GPU to A40 or RTX 4090 (recommended)
6. Set timeout to 300 seconds
7. Deploy and get your endpoint ID

### Step 8: Update Web App

In the web application, use your endpoint URL:
```
https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync
```

## Complete Handler Fix

Create a `handler.py` file with this structure:

```python
import runpod
import base64
import io
import os
from PIL import Image
import tempfile

# Import your processing modules (remove the dots for absolute imports)
from instantmesh_runner import InstantMeshRunner, process_image_pipeline
from genshin_style_converter import GenshinStyleConverter
from weapon_remover import WeaponRemover
from character_rigger import CharacterRigger

def handler(job):
    """
    Main handler function for RunPod serverless endpoint
    """
    try:
        job_input = job.get('input', {})
        
        # Extract parameters
        image_url = job_input.get('image_url')
        remove_weapon = job_input.get('remove_weapon', True)
        character_gender = job_input.get('character_gender', 'auto')
        enable_rigging = job_input.get('enable_rigging', True)
        
        if not image_url:
            return {"error": "No image_url provided"}
        
        # Process the image through the pipeline
        result = process_image_pipeline(
            image_url=image_url,
            remove_weapon=remove_weapon,
            character_gender=character_gender,
            enable_rigging=enable_rigging,
            **job_input
        )
        
        return {"status": "success", "output": result}
        
    except Exception as e:
        return {"error": str(e), "status": "failed"}

# Start the serverless function
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
```

## File Structure

Your RunPod container should have this structure:

```
/app/
├── handler.py                    # Main entry point (fixed imports)
├── instantmesh_runner.py         # Your InstantMesh processing
├── genshin_style_converter.py    # Genshin style conversion
├── weapon_remover.py             # Weapon removal logic
├── character_rigger.py           # Character rigging
├── requirements.txt              # Python dependencies
└── configs/
    └── instant-mesh-large.yaml   # InstantMesh configuration
```

## Dockerfile Example

```dockerfile
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application code
COPY . .

# Set the handler
CMD ["python", "handler.py"]
```

## Testing the Fix

1. Update your handler.py to use absolute imports (remove the dots)
2. Rebuild your Docker image
3. Push to GitHub Container Registry
4. Update your RunPod endpoint to use the new image
5. Test with the web application

## Environment Variables

Make sure these environment variables are set in your RunPod container:
- `CUDA_VISIBLE_DEVICES=0`
- Any API keys needed for your processing pipeline

The container image field should simply be:
**runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04**

## Alternative: Quick Start with Base Image

If you don't want to build your own container, you can use RunPod's base image and upload code manually:

### Step 1: Use Base Image
Container Image: `runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04`

### Step 2: Upload Code via RunPod File Manager
1. Deploy endpoint with base image
2. Go to RunPod "My Pods" → "Connect" → "JupyterLab" or "Terminal"
3. Upload your Python files manually
4. Install requirements: `pip install -r requirements.txt`

### Step 3: Fix Import Errors
Make sure all imports are absolute (no leading dots):
```python
# ✅ CORRECT
from instantmesh_runner import process_image_pipeline
from genshin_style_converter import GenshinStyleConverter

# ❌ WRONG
from .instantmesh_runner import process_image_pipeline
from .genshin_style_converter import GenshinStyleConverter
```

## Troubleshooting

### Container Registry Access Denied
- The original `ghcr.io/aptol-7176/genshin-art-3d-model:latest` is private
- Build your own container or use the base image approach

### Import Errors
- Remove all leading dots from imports
- Add `/app` to Python path: `ENV PYTHONPATH="/app:$PYTHONPATH"`
- Make sure all Python files are in the container's `/app` directory

### GPU Memory Issues
- Use A40 or RTX 4090 GPUs
- Set container disk to at least 20GB
- Monitor GPU usage in RunPod dashboard

## Testing Your Setup

Use the "Test Connection" button in the web app. It sends a debug request that should return:
```json
{
  "status": "success", 
  "message": "RunPod handler is working correctly!",
  "available_functions": ["pixel_to_genshin_conversion", "weapon_removal", "character_rigging", "3d_model_generation"]
}
```

## Summary

**The main issues are:**
1. **Container image is private** - you need to build your own or use base image
2. **Import errors** - change `from .module` to `from module` (remove dots)
3. **Missing dependencies** - make sure all required packages are installed

**Quick fix:** Use `runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04` as container image, then upload and fix your Python code manually.