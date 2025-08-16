#!/usr/bin/env python3
"""Simple test script for the handler"""

import sys
import os

# Add current directory to path so we can import modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from handler import handler
    print("✓ Successfully imported handler")
    
    # Test debug_help
    test_event = {
        "input": {
            "debug_help": True
        }
    }
    
    print("Testing debug_help...")
    result = handler(test_event)
    print(f"Result: {result}")
    
    if result.get("ok"):
        print("✓ Debug help test passed")
    else:
        print("✗ Debug help test failed")
        print(f"Error: {result.get('stderr', 'No stderr')}")
        
except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"✗ Runtime error: {e}")
    sys.exit(1)