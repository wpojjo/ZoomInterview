"use client";

import { useState } from "react";
import { useRouter } from "nextjs-toploader/app";

interface Education {
  id?: string;
  schoolName: string;
  major: string;
  degree: "학사" | "석사" | "박사";
  startDate: string;
  endDate?: string | null;
  graduationStatus: "재학중" | "졸업" | "졸업예정" | "중퇴" | "휴학중";
}

interface Career {
  id?: string;
  companyName: string;
  role: string;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
}

interface Certification {
  id?: string;
  name: string;
  grade?: string | null;
}

interface Activity {
  id?: string;
  title: string;
  role: string;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
}

interface InitialData {
  name?: string;
  educations?: Array<Omit<Education, "graduationStatus" | "degree"> & { graduationStatus: string; degree?: string | null }>;
  careers?: Career[];
  certifications?: Certification[];
  activities?: Activity[];
}

function newEducation(): Education {
  return { schoolName: "", major: "", degree: "학사", startDate: "", endDate: "", graduationStatus: "재학중" };
}
function newCareer(): Career {
  return { companyName: "", role: "", startDate: "", endDate: "", description: "" };
}
function newCertification(): Certification {
  return { name: "", grade: "" };
}
function newActivity(): Activity {
  return { title: "", role: "", startDate: "", endDate: "", description: "" };
}

export default function ProfileForm({ name, initialData }: { name: string; initialData?: InitialData | null }) {
  const [educations, setEducations] = useState<Education[]>(
    initialData?.educations?.length
      ? initialData.educations.map((e) => ({
          ...e,
          degree: (e.degree as Education["degree"]) ?? "학사",
          graduationStatus: e.graduationStatus as Education["graduationStatus"],
        }))
      : []
  );
  const [careers, setCareers] = useState<Career[]>(initialData?.careers ?? []);
  const [certifications, setCertifications] = useState<Certification[]>(initialData?.certifications ?? []);
  const [activities, setActivities] = useState<Activity[]>(initialData?.activities ?? []);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, educations, careers, certifications, activities }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "저장에 실패했습니다");
        setStatus("error");
      } else {
        router.push("/job-posting");
      }
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다");
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-6">
      {/* 이름 확인 카드 */}
      <div className="card px-6 py-5 flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xl font-bold">{name[0]}</span>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-slate-500 mb-0.5">이름</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-slate-50">{name}</p>
        </div>
      </div>

      {/* 학력 */}
      <Section
        title="학력"
        count={educations.length}
        onAdd={() => setEducations((p) => [...p, newEducation()])}
      >
        {educations.length === 0 ? (
          <EmptyState text="학력 정보가 없습니다" />
        ) : educations.map((edu, i) => (
          <ItemCard key={i} onDelete={() => setEducations((p) => p.filter((_, idx) => idx !== i))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="학교명">
                <input type="text" value={edu.schoolName} onChange={(e) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, schoolName: e.target.value } : item))} placeholder="OO대학교" className="input" />
              </Field>
              <Field label="전공">
                <input type="text" value={edu.major} onChange={(e) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, major: e.target.value } : item))} placeholder="컴퓨터공학" className="input" />
              </Field>
              <Field label="학위">
                <select value={edu.degree} onChange={(e) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, degree: e.target.value as Education["degree"] } : item))} className="input">
                  {["학사", "석사", "박사"].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="졸업상태">
                <select value={edu.graduationStatus} onChange={(e) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, graduationStatus: e.target.value as Education["graduationStatus"] } : item))} className="input">
                  {["재학중", "졸업", "졸업예정", "중퇴", "휴학중"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="입학일">
                <input type="month" value={edu.startDate} onChange={(e) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, startDate: e.target.value } : item))} className="input" />
              </Field>
              <Field label="졸업일">
                <input type="month" value={edu.endDate ?? ""} onChange={(e) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, endDate: e.target.value } : item))} className="input" />
              </Field>
            </div>
          </ItemCard>
        ))}
      </Section>

      {/* 경력 */}
      <Section
        title="경력"
        count={careers.length}
        onAdd={() => setCareers((p) => [...p, newCareer()])}
      >
        {careers.length === 0 ? (
          <EmptyState text="경력 정보가 없습니다" />
        ) : careers.map((career, i) => (
          <ItemCard key={i} onDelete={() => setCareers((p) => p.filter((_, idx) => idx !== i))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="회사명">
                <input type="text" value={career.companyName} onChange={(e) => setCareers((p) => p.map((item, idx) => idx === i ? { ...item, companyName: e.target.value } : item))} placeholder="(주)OO회사" className="input" />
              </Field>
              <Field label="직무">
                <input type="text" value={career.role} onChange={(e) => setCareers((p) => p.map((item, idx) => idx === i ? { ...item, role: e.target.value } : item))} placeholder="백엔드 개발자" className="input" />
              </Field>
              <Field label="시작일">
                <input type="month" value={career.startDate} onChange={(e) => setCareers((p) => p.map((item, idx) => idx === i ? { ...item, startDate: e.target.value } : item))} className="input" />
              </Field>
              <Field label="종료일">
                <input type="month" value={career.endDate ?? ""} onChange={(e) => setCareers((p) => p.map((item, idx) => idx === i ? { ...item, endDate: e.target.value } : item))} className="input" />
              </Field>
            </div>
            <Field label="업무 설명">
              <textarea value={career.description ?? ""} onChange={(e) => setCareers((p) => p.map((item, idx) => idx === i ? { ...item, description: e.target.value } : item))} placeholder="주요 업무 내용을 간략히 적어주세요" rows={2} className="input resize-none" />
            </Field>
          </ItemCard>
        ))}
      </Section>

      {/* 자격증 */}
      <Section
        title="자격증"
        count={certifications.length}
        onAdd={() => setCertifications((p) => [...p, newCertification()])}
      >
        {certifications.length === 0 ? (
          <EmptyState text="자격증 정보가 없습니다" />
        ) : certifications.map((cert, i) => (
          <ItemCard key={i} onDelete={() => setCertifications((p) => p.filter((_, idx) => idx !== i))}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="자격증명">
                <input type="text" value={cert.name} onChange={(e) => setCertifications((p) => p.map((item, idx) => idx === i ? { ...item, name: e.target.value } : item))} placeholder="정보처리기사" className="input" />
              </Field>
              <Field label="등급 / 점수 (선택)">
                <input type="text" value={cert.grade ?? ""} onChange={(e) => setCertifications((p) => p.map((item, idx) => idx === i ? { ...item, grade: e.target.value } : item))} placeholder="예) 1급, 900점" className="input" />
              </Field>
            </div>
          </ItemCard>
        ))}
      </Section>

      {/* 대외활동 */}
      <Section
        title="대외활동"
        count={activities.length}
        onAdd={() => setActivities((p) => [...p, newActivity()])}
      >
        {activities.length === 0 ? (
          <EmptyState text="대외활동 정보가 없습니다" />
        ) : activities.map((act, i) => (
          <ItemCard key={i} onDelete={() => setActivities((p) => p.filter((_, idx) => idx !== i))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="활동명">
                <input type="text" value={act.title} onChange={(e) => setActivities((p) => p.map((item, idx) => idx === i ? { ...item, title: e.target.value } : item))} placeholder="UX 스터디" className="input" />
              </Field>
              <Field label="역할">
                <input type="text" value={act.role} onChange={(e) => setActivities((p) => p.map((item, idx) => idx === i ? { ...item, role: e.target.value } : item))} placeholder="팀장" className="input" />
              </Field>
              <Field label="시작일">
                <input type="month" value={act.startDate} onChange={(e) => setActivities((p) => p.map((item, idx) => idx === i ? { ...item, startDate: e.target.value } : item))} className="input" />
              </Field>
              <Field label="종료일">
                <input type="month" value={act.endDate ?? ""} onChange={(e) => setActivities((p) => p.map((item, idx) => idx === i ? { ...item, endDate: e.target.value } : item))} className="input" />
              </Field>
            </div>
            <Field label="활동 설명">
              <textarea value={act.description ?? ""} onChange={(e) => setActivities((p) => p.map((item, idx) => idx === i ? { ...item, description: e.target.value } : item))} placeholder="활동 내용을 간략히 적어주세요" rows={2} className="input resize-none" />
            </Field>
          </ItemCard>
        ))}
      </Section>

      {/* 저장 버튼 */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-1">
        {status === "error" && <p className="text-red-500 text-sm">{errorMessage}</p>}
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full sm:w-auto px-8">
          {saving ? "저장 중..." : "다음 →"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  onAdd,
  children,
}: {
  title: string;
  count: number;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-gray-800 dark:text-slate-100">{title}</span>
          {count > 0 && (
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          추가
        </button>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function ItemCard({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  return (
    <div className="relative rounded-xl border border-gray-100 dark:border-slate-600 bg-gray-50/60 dark:bg-slate-700/30 p-4 space-y-3">
      <button
        onClick={onDelete}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        aria-label="삭제"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-6 flex flex-col items-center gap-1.5 text-gray-400 dark:text-slate-600">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-400 dark:text-slate-500">{label}</label>
      {children}
    </div>
  );
}
