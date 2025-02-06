from fastapi import FastAPI, Request
import uvicorn
import json
from typing import Dict, Any, Optional
from pydantic import BaseModel

class StormArticleResponse(BaseModel):
    content: str
    outline: Optional[str]
    sources: Dict[str, Any]
    polished_content: Optional[str]
    error: Optional[str]

app = FastAPI()

@app.post("/webhooks/article-generated")
async def webhook_receiver(request: Request):
    try:
        # Get the raw payload
        payload = await request.json()
        
        print("\n" + "="*50)
        print("WEBHOOK RECEIVED")
        print("="*50)
        
        # Print status and metadata
        print(f"\nStatus: {payload.get('status', 'unknown')}")
        print(f"Metadata: {json.dumps(payload.get('metadata', {}), indent=2)}")
        
        # Print the article data
        result = payload.get("result", {})
        print("\nArticle Content:")
        print("-"*30)
        print(result.get("content", "No content"))
        
        if result.get("outline"):
            print("\nOutline:")
            print("-"*30)
            print(result["outline"])
        
        if result.get("sources"):
            print("\nSources:")
            print("-"*30)
            print(json.dumps(result["sources"], indent=2))
        
        if result.get("polished_content"):
            print("\nPolished Content:")
            print("-"*30)
            print(result["polished_content"])
        
        if result.get("error"):
            print("\nError:")
            print("-"*30)
            print(result["error"])
            
        print("\n" + "="*50 + "\n")
        
        return {"status": "success", "message": "Webhook received"}
        
    except Exception as e:
        print("\n" + "="*50)
        print("ERROR PROCESSING WEBHOOK")
        print(f"Error: {str(e)}")
        print("="*50 + "\n")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    print("\nWebhook test server running on http://localhost:8001")
    print("Waiting for webhooks at http://localhost:8001/webhooks/article-generated")
    print("Press Ctrl+C to stop the server\n")
    uvicorn.run(app, host="0.0.0.0", port=8001) 