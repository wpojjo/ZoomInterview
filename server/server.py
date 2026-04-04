from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from extract_job import fetch_text, extract_job_info

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


class URLRequest(BaseModel):
    url: str


@app.post("/extract")
def extract(req: URLRequest):
    try:
        text = fetch_text(req.url)
        if len(text) < 100:
            raise HTTPException(status_code=422, detail="페이지에서 텍스트를 충분히 추출하지 못했습니다.")
        result = extract_job_info(text)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
