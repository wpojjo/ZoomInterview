# 기여 가이드

## 브랜치 전략

`main` 브랜치에 직접 커밋하지 않습니다. 모든 작업은 feature 브랜치에서 진행하고 PR로 머지합니다.

## 작업 흐름

**1. 작업 시작 전 main 최신화**
```bash
git checkout main
git pull
```

**2. feature 브랜치 생성**
```bash
git checkout -b feature/작업내용
```

**3. 작업 후 커밋 & 푸시**
```bash
git add 파일명
git commit -m "feat: 설명"
git push origin feature/작업내용
```

**4. GitHub에서 PR 생성 → 리뷰 → 머지**

**5. 머지 후 브랜치 삭제**
```bash
git branch -d feature/작업내용
git remote prune origin
```

## 브랜치 이름 컨벤션

| 접두사 | 용도 |
|--------|------|
| `feature/` | 새 기능 |
| `fix/` | 버그 수정 |
| `chore/` | 설정, 의존성 등 |
| `docs/` | 문서 |

## 작업 중 main에 변경사항이 생겼을 때

다른 팀원이 main에 푸시한 경우 내 브랜치에 반영합니다.

```bash
git fetch origin
git merge origin/main
```

충돌이 있으면 해결 후 커밋, 없으면 그냥 진행합니다.

## 커밋 메시지 컨벤션

```
feat: 새 기능
fix: 버그 수정
docs: 문서 수정
chore: 설정, 의존성 등
refactor: 리팩토링
```
