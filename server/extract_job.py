import sys
import json
import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5:7b"


def fetch_text(url: str) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)  # JS 렌더링 대기
        html = page.content()
        browser.close()

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    return text[:8000]


def extract_job_info(text: str) -> dict:
    prompt = f"""아래는 채용공고 텍스트입니다.
텍스트에서 의미상 아래 세 가지 항목에 해당하는 내용을 찾아 JSON으로 추출해주세요.
항목명이 정확히 일치하지 않아도 의미가 같으면 해당 항목으로 분류하세요.

분류 기준:
- "업무 내용": 담당업무, 하는 일, 주요 역할, 업무 소개, What you'll do, Responsibilities 등
- "지원 자격": 자격 요건, 필수 조건, 이런 분을 찾아요, Requirements, Qualifications 등
- "우대 사항": 우대 조건, 이런 분이면 더 좋아요, Preferred, Nice to have 등

명시적인 항목 구분 없이 문장이 나열된 경우에도 문맥을 파악해서 적절히 분류하세요.
해당 항목이 없으면 빈 리스트로 반환하세요.

출력 형식 (반드시 JSON만 출력, 다른 텍스트 없이):
{{
  "업무 내용": ["...", "..."],
  "지원 자격": ["...", "..."],
  "우대 사항": ["...", "..."]
}}

채용공고:
{text}
"""

    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
    }

    resp = requests.post(OLLAMA_URL, json=payload, timeout=120)
    resp.raise_for_status()
    raw = resp.json()["response"]

    # JSON 블록 파싱
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        return {"error": "JSON 파싱 실패", "raw": raw}
    data = json.loads(raw[start:end])

    # 키 정규화: 모델이 다른 표현으로 출력해도 올바른 항목으로 매핑
    KEY_MAP = {
        "업무": "업무 내용",
        "담당": "업무 내용",
        "역할": "업무 내용",
        "자격": "지원 자격",
        "필수": "지원 자격",
        "요건": "지원 자격",
        "우대": "우대 사항",
        "preferred": "우대 사항",
        "추가": "우대 사항",
    }
    normalized = {"업무 내용": [], "지원 자격": [], "우대 사항": []}
    for key, value in data.items():
        matched = None
        for keyword, canonical in KEY_MAP.items():
            if keyword in key:
                matched = canonical
                break
        if matched:
            normalized[matched] = value
        elif key in normalized:
            normalized[key] = value
    return normalized


def main():
    url = input("채용공고 URL을 입력하세요: ").strip()
    if not url:
        print("URL을 입력해주세요.")
        sys.exit(1)

    print("\n[1/2] 페이지 크롤링 중...")
    text = fetch_text(url)
    print(f"      텍스트 {len(text)}자 추출 완료")
    print("\n--- 추출된 텍스트 미리보기 (앞 500자) ---")
    print(text[:500])
    print("-------------------------------------------\n")

    print("[2/2] Ollama로 분석 중... (잠시 기다려주세요)\n")
    result = extract_job_info(text)

    if "error" in result:
        print("분석 실패:", result)
        return

    for section, items in result.items():
        print(f"▶ {section}")
        if items:
            for item in items:
                print(f"  • {item}")
        else:
            print("  (정보 없음)")
        print()


if __name__ == "__main__":
    main()
