"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileInput } from "@/lib/schemas";

type ProfileData = ProfileInput & { id?: string };

interface Education {
  id?: string;
  schoolName: string;
  major: string;
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
  acquiredDate: string;
}

interface Activity {
  id?: string;
  title: string;
  role: string;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
}

interface InitialEducation extends Omit<Education, "graduationStatus"> {
  graduationStatus: string;
}

interface InitialData {
  name?: string;
  educations?: InitialEducation[];
  careers?: Career[];
  certifications?: Certification[];
  activities?: Activity[];
}

function newEducation(): Education {
  return { schoolName: "", major: "", startDate: "", endDate: "", graduationStatus: "재학중" };
}
function newCareer(): Career {
  return { companyName: "", role: "", startDate: "", endDate: "", description: "" };
}
function newCertification(): Certification {
  return { name: "", acquiredDate: "" };
}
function newActivity(): Activity {
  return { title: "", role: "", startDate: "", endDate: "", description: "" };
}

export default function ProfileForm({ name, initialData }: { name: string; initialData?: InitialData | null }) {
  const [educations, setEducations] = useState<Education[]>(
    initialData?.educations?.length
      ? initialData.educations.map((e) => ({ ...e, graduationStatus: e.graduationStatus as Education["graduationStatus"] }))
      : []
  );
  const [careers, setCareers] = useState<Career[]>(
    initialData?.careers?.length ? initialData.careers : []
  );
  const [certifications, setCertifications] = useState<Certification[]>(
    initialData?.certifications?.length ? initialData.certifications : []
  );
  const [activities, setActivities] = useState<Activity[]>(
    initialData?.activities?.length ? initialData.activities : []
  );
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
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
    <div className="space-y-6">
      {/* Education */}
      <Card
        title="학력"
        onAdd={() => setEducations((prev) => [...prev, newEducation()])}
      >
        {educations.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">학력을 추가해주세요</p>
        )}
        {educations.map((edu, i) => (
          <div key={i} className="border border-gray-100 dark:border-slate-600 rounded-xl p-4 space-y-3 relative bg-gray-50/50 dark:bg-slate-700/30">
            <button
              onClick={() => setEducations((prev) => prev.filter((_, idx) => idx !== i))}
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-xs transition-colors"
            >
              삭제
            </button>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="학교명">
                <input
                  type="text"
                  value={edu.schoolName}
                  onChange={(e) => setEducations((prev) => prev.map((item, idx) => idx === i ? { ...item, schoolName: e.target.value } : item))}
                  placeholder="OO대학교"
                  className="input"
                />
              </FormField>
              <FormField label="전공">
                <input
                  type="text"
                  value={edu.major}
                  onChange={(e) => setEducations((prev) => prev.map((item, idx) => idx === i ? { ...item, major: e.target.value } : item))}
                  placeholder="컴퓨터공학"
                  className="input"
                />
              </FormField>
              <FormField label="입학일">
                <input
                  type="month"
                  value={edu.startDate}
                  onChange={(e) => setEducations((prev) => prev.map((item, idx) => idx === i ? { ...item, startDate: e.target.value } : item))}
                  className="input"
                />
              </FormField>
              <FormField label="졸업일">
                <input
                  type="month"
                  value={edu.endDate ?? ""}
                  onChange={(e) => setEducations((prev) => prev.map((item, idx) => idx === i ? { ...item, endDate: e.target.value } : item))}
                  className="input"
                />
              </FormField>
              <FormField label="졸업상태">
                <select
                  value={edu.graduationStatus}
                  onChange={(e) => setEducations((prev) => prev.map((item, idx) => idx === i ? { ...item, graduationStatus: e.target.value as Education["graduationStatus"] } : item))}
                  className="input"
                >
                  {["재학중", "졸업", "졸업예정", "중퇴", "휴학중"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>
        ))}
      </Card>

      {/* Career */}
      <Card
        title="경력"
        onAdd={() => setCareers((prev) => [...prev, newCareer()])}
      >
        {careers.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">경력을 추가해주세요</p>
        )}
        {careers.map((career, i) => (
          <div key={i} className="border border-gray-100 dark:border-slate-600 rounded-xl p-4 space-y-3 relative bg-gray-50/50 dark:bg-slate-700/30">
            <button
              onClick={() => setCareers((prev) => prev.filter((_, idx) => idx !== i))}
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-xs transition-colors"
            >
              삭제
            </button>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="회사명">
                <input
                  type="text"
                  value={career.companyName}
                  onChange={(e) => setCareers((prev) => prev.map((item, idx) => idx === i ? { ...item, companyName: e.target.value } : item))}
                  placeholder="(주)OO회사"
                  className="input"
                />
              </FormField>
              <FormField label="직무">
                <input
                  type="text"
                  value={career.role}
                  onChange={(e) => setCareers((prev) => prev.map((item, idx) => idx === i ? { ...item, role: e.target.value } : item))}
                  placeholder="백엔드 개발자"
                  className="input"
                />
              </FormField>
              <FormField label="시작일">
                <input
                  type="month"
                  value={career.startDate}
                  onChange={(e) => setCareers((prev) => prev.map((item, idx) => idx === i ? { ...item, startDate: e.target.value } : item))}
                  className="input"
                />
              </FormField>
              <FormField label="종료일">
                <input
                  type="month"
                  value={career.endDate ?? ""}
                  onChange={(e) => setCareers((prev) => prev.map((item, idx) => idx === i ? { ...item, endDate: e.target.value } : item))}
                  className="input"
                />
              </FormField>
            </div>
            <FormField label="업무 설명">
              <textarea
                value={career.description ?? ""}
                onChange={(e) => setCareers((prev) => prev.map((item, idx) => idx === i ? { ...item, description: e.target.value } : item))}
                placeholder="주요 업무 내용을 간략히 적어주세요"
                rows={2}
                className="input resize-none"
              />
            </FormField>
          </div>
        ))}
      </Card>

      {/* Certifications */}
      <Card
        title="자격증"
        onAdd={() => setCertifications((prev) => [...prev, newCertification()])}
      >
        {certifications.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">자격증을 추가해주세요</p>
        )}
        {certifications.map((cert, i) => (
          <div key={i} className="border border-gray-100 dark:border-slate-600 rounded-xl p-4 relative bg-gray-50/50 dark:bg-slate-700/30">
            <button
              onClick={() => setCertifications((prev) => prev.filter((_, idx) => idx !== i))}
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-xs transition-colors"
            >
              삭제
            </button>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="자격증명">
                <input
                  type="text"
                  value={cert.name}
                  onChange={(e) => setCertifications((prev) => prev.map((item, idx) => idx === i ? { ...item, name: e.target.value } : item))}
                  placeholder="정보처리기사"
                  className="input"
                />
              </FormField>
              <FormField label="취득일">
                <input
                  type="month"
                  value={cert.acquiredDate}
                  onChange={(e) => setCertifications((prev) => prev.map((item, idx) => idx === i ? { ...item, acquiredDate: e.target.value } : item))}
                  className="input"
                />
              </FormField>
            </div>
          </div>
        ))}
      </Card>

      {/* Activities */}
      <Card
        title="대외활동"
        onAdd={() => setActivities((prev) => [...prev, newActivity()])}
      >
        {activities.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">대외활동을 추가해주세요</p>
        )}
        {activities.map((act, i) => (
          <div key={i} className="border border-gray-100 dark:border-slate-600 rounded-xl p-4 space-y-3 relative bg-gray-50/50 dark:bg-slate-700/30">
            <button
              onClick={() => setActivities((prev) => prev.filter((_, idx) => idx !== i))}
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-xs transition-colors"
            >
              삭제
            </button>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="활동명">
                <input
                  type="text"
                  value={act.title}
                  onChange={(e) => setActivities((prev) => prev.map((item, idx) => idx === i ? { ...item, title: e.target.value } : item))}
                  placeholder="UX 스터디"
                  className="input"
                />
              </FormField>
              <FormField label="역할">
                <input
                  type="text"
                  value={act.role}
                  onChange={(e) => setActivities((prev) => prev.map((item, idx) => idx === i ? { ...item, role: e.target.value } : item))}
                  placeholder="팀장"
                  className="input"
                />
              </FormField>
              <FormField label="시작일">
                <input
                  type="month"
                  value={act.startDate}
                  onChange={(e) => setActivities((prev) => prev.map((item, idx) => idx === i ? { ...item, startDate: e.target.value } : item))}
                  className="input"
                />
              </FormField>
              <FormField label="종료일">
                <input
                  type="month"
                  value={act.endDate ?? ""}
                  onChange={(e) => setActivities((prev) => prev.map((item, idx) => idx === i ? { ...item, endDate: e.target.value } : item))}
                  className="input"
                />
              </FormField>
            </div>
            <FormField label="활동 설명">
              <textarea
                value={act.description ?? ""}
                onChange={(e) => setActivities((prev) => prev.map((item, idx) => idx === i ? { ...item, description: e.target.value } : item))}
                placeholder="활동 내용을 간략히 적어주세요"
                rows={2}
                className="input resize-none"
              />
            </FormField>
          </div>
        ))}
      </Card>

      {/* Save Button & Status */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 pb-6">
        {status === "error" && (
          <p className="text-red-500 text-sm">{errorMessage}</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full sm:w-auto px-8"
        >
          {saving ? "저장 중..." : "다음 →"}
        </button>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  onAdd,
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
        <h2 className="font-semibold text-gray-800 dark:text-slate-100">{title}</h2>
        {onAdd && (
          <button
            onClick={onAdd}
            className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            + 추가
          </button>
        )}
      </div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  );
}
