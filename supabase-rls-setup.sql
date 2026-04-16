-- ============================================================
-- RLS (Row Level Security) 설정 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================================

-- 1. 모든 테이블에 RLS 활성화
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE educations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE careers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. profiles 테이블 정책
-- ============================================================
CREATE POLICY "profiles: 본인만 접근"
  ON profiles
  FOR ALL
  USING (auth.uid()::text = "userId"::text)
  WITH CHECK (auth.uid()::text = "userId"::text);

-- ============================================================
-- 3. educations 테이블 정책 (profiles.userId 통해 확인)
-- ============================================================
CREATE POLICY "educations: 본인만 접근"
  ON educations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = educations."profileId"
        AND profiles."userId"::text = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = educations."profileId"
        AND profiles."userId"::text = auth.uid()::text
    )
  );

-- ============================================================
-- 4. careers 테이블 정책
-- ============================================================
CREATE POLICY "careers: 본인만 접근"
  ON careers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = careers."profileId"
        AND profiles."userId"::text = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = careers."profileId"
        AND profiles."userId"::text = auth.uid()::text
    )
  );

-- ============================================================
-- 5. certifications 테이블 정책
-- ============================================================
CREATE POLICY "certifications: 본인만 접근"
  ON certifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = certifications."profileId"
        AND profiles."userId"::text = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = certifications."profileId"
        AND profiles."userId"::text = auth.uid()::text
    )
  );

-- ============================================================
-- 6. activities 테이블 정책
-- ============================================================
CREATE POLICY "activities: 본인만 접근"
  ON activities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = activities."profileId"
        AND profiles."userId"::text = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = activities."profileId"
        AND profiles."userId"::text = auth.uid()::text
    )
  );

-- ============================================================
-- 7. job_postings 테이블 정책
-- ============================================================
CREATE POLICY "job_postings: 본인만 접근"
  ON job_postings
  FOR ALL
  USING (auth.uid()::text = "userId"::text)
  WITH CHECK (auth.uid()::text = "userId"::text);

-- ============================================================
-- 8. interview_sessions 테이블 정책
-- ============================================================
CREATE POLICY "interview_sessions: 본인만 접근"
  ON interview_sessions
  FOR ALL
  USING (auth.uid()::text = "userId"::text)
  WITH CHECK (auth.uid()::text = "userId"::text);
