# 플로우 다이어그램

## 전체 흐름

```
채용공고 입력
    │
    ▼
채용공고 분석 (Jina + OCR + LLM)
    │
    ├──────────────────────────────────┐
    │                                  │
    ▼ (비동기)                         ▼ (면접 시작 시)
DART 기업정보 수집                    뉴스 크롤링
(6개월 캐싱)                          (normal/hard만)
    │                                  │
    └──────────────┬───────────────────┘
                   │
                   ▼
            면접 진행 (3 에이전트)
            Organization → Logic → Technical
            각 에이전트: 기본 질문 → 꼬리질문(0~3회)
                   │
                   ▼
            토론 (4 라운드)
            Round 0: 독립 평가
            Round 1: 상호 피드백
            Round 2: 재반박
            Round 3: 최종 의견
                   │
                   ▼
            중재자 종합 점수 및 피드백
```

---

## 면접 평가 플로우

```mermaid
sequenceDiagram
  participant C as 클라이언트
  participant API as /api/interview/debate
  participant DB as Supabase DB
  participant LLM as RunPod LLM

  C->>API: POST (messages, difficulty)
  API->>DB: session INSERT (status: evaluating)
  API-->>C: { sessionId }

  Note over API,LLM: 백그라운드 실행 (Vercel waitUntil)

  loop Round 0 — 에이전트별 독립 BARS 채점
    API->>LLM: generateAgentEvaluation()
    LLM-->>API: score · verdict · highlights
  end
  API->>DB: agentEvaluations 저장 (status: debating)

  loop Round 1 — 스탠스 피드백 (−2 ~ +2)
    API->>LLM: generateAgentReply()
    LLM-->>API: stance · comment
  end
  API->>DB: debateReplies 저장

  loop Round 2a — 재반박
    API->>LLM: generateAgentRebuttal()
    LLM-->>API: rebuttals
  end
  API->>DB: agentRebuttals 저장 (status: finalizing)

  loop Round 2b — 스탠스 갱신
    API->>LLM: generateAgentFinalOpinion()
    LLM-->>API: finalStance
  end
  API->>DB: agentFinalOpinions 저장

  API->>LLM: generateModeratorSummary()
  LLM-->>API: finalScore · finalFeedback · improvementTips
  API->>DB: 최종 결과 저장 (status: done)

  loop 폴링
    C->>API: GET /debate/[sessionId]/status
    API-->>C: { status, finalScore, finalFeedback, ... }
  end
```

---

## 채용공고 분석 플로우

```mermaid
flowchart TD
  Start([분석 시작]) --> HasText{pastedText\n있음?}

  HasText -->|Yes| TextReady[텍스트 사용]
  HasText -->|No| Jina[Jina API\nURL → 마크다운]
  Jina --> ExtImg[이미지 URL 추출\n최대 3개]
  ExtImg --> OCR[Google Vision OCR]
  OCR --> Merge[텍스트 + OCR 병합\n더 긴 것 선택]
  Merge --> TextReady

  TextReady --> LLM[LLM 분석\n8개 필드 추출]
  LLM -->|성공| SaveDB[job_postings UPSERT]
  LLM -->|실패| E422[422\nneedsManualInput: true]

  SaveDB --> HasCo{회사명 있음?}
  HasCo -->|No| Done([완료])
  HasCo -->|Yes| BG

  subgraph BG["백그라운드 병렬 수집 (fire-and-forget)"]
    direction LR
    D[DART\n공시·재무·임직원]
    H[홈페이지 크롤러\n회사 소개]
  end

  BG --> Done
```

---

## DB 스키마

```mermaid
erDiagram
  users ||--o| profiles : ""
  users ||--o{ interview_sessions : ""
  users ||--o{ job_postings : ""
  profiles ||--o{ educations : ""
  profiles ||--o{ careers : ""
  profiles ||--o{ certifications : ""
  profiles ||--o{ activities : ""

  users {
    uuid id PK
    string email
  }
  profiles {
    uuid id PK
    uuid userId FK
    string name
    timestamp updatedAt
  }
  educations {
    uuid id PK
    uuid profileId FK
    string school
    string major
    string degree
  }
  careers {
    uuid id PK
    uuid profileId FK
    string company
    string position
  }
  certifications {
    uuid id PK
    uuid profileId FK
    string name
    string date
  }
  activities {
    uuid id PK
    uuid profileId FK
    string name
    string description
  }
  interview_sessions {
    uuid id PK
    uuid userId FK
    json messages
    string difficulty
    string status
    json agentEvaluations
    json debateReplies
    json agentRebuttals
    json agentFinalOpinions
    number finalScore
    json finalFeedback
    boolean pinned
    timestamp updatedAt
  }
  job_postings {
    uuid id PK
    uuid userId FK
    string sourceUrl
    string sourceType
    string companyName
    string responsibilities
    string requirements
    string techStack
    string companyDescription
    timestamp updatedAt
  }
```
