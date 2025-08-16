# RunPod Container Setup Guide

## The Error You're Seeing

The error `ImportError: attempted relative import with no known parent package` occurs because the Python handler file is trying to use relative imports incorrectly.

## Container Image Field

In the RunPod "Container Image" field, you should enter:

```
ghcr.io/aptol-7176/genshin-art-3d-model:latest
```

This is the Docker image that contains your processing pipeline.

## Fixing the Handler Error

The main issue is in the handler.py file. Here's what needs to be fixed:

### Current problematic code:
```python
from .instantmesh_runner import (
    InstantMeshRunner,
    process_image_pipeline
)
```

### Fixed code:
```python
from instantmesh_runner import (
    InstantMeshRunner,
    process_image_pipeline
)
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
**ghcr.io/aptol-7176/genshin-art-3d-model:latest**