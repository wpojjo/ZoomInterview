"use client";

import { useState } from "react";
import CustomSelect from "@/components/CustomSelect";
import MonthPicker from "@/components/MonthPicker";

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

type Snapshot = {
  name: string;
  educations: Education[];
  careers: Career[];
  certifications: Certification[];
  activities: Activity[];
};

type SectionKey = "educations" | "careers" | "certifications" | "activities";

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

function parseInitial(initialData: InitialData): Snapshot {
  return {
    name: initialData.name ?? "",
    educations: initialData.educations?.length
      ? initialData.educations.map((e) => ({
          ...e,
          degree: (e.degree as Education["degree"]) ?? "학사",
          graduationStatus: e.graduationStatus as Education["graduationStatus"],
        }))
      : [],
    careers: initialData.careers ?? [],
    certifications: initialData.certifications ?? [],
    activities: initialData.activities ?? [],
  };
}

export default function SettingsForm({ initialData }: { initialData: InitialData }) {
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => parseInitial(initialData));

  const [educations, setEducations] = useState<Education[]>(snapshot.educations);
  const [careers, setCareers] = useState<Career[]>(snapshot.careers);
  const [certifications, setCertifications] = useState<Certification[]>(snapshot.certifications);
  const [activities, setActivities] = useState<Activity[]>(snapshot.activities);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function startEdit(section: SectionKey) {
    setEditingSection(section);
    setSaveError("");
  }

  function cancelEdit(section: SectionKey) {
    switch (section) {
      case "educations": setEducations(snapshot.educations); break;
      case "careers": setCareers(snapshot.careers); break;
      case "certifications": setCertifications(snapshot.certifications); break;
      case "activities": setActivities(snapshot.activities); break;
    }
    setEditingSection(null);
    setSaveError("");
  }

  async function saveSection(_section: SectionKey) {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: snapshot.name, educations, careers, certifications, activities }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "저장에 실패했습니다");
      } else {
        setSnapshot({ name: snapshot.name, educations, careers, certifications, activities });
        setEditingSection(null);
      }
    } catch {
      setSaveError("네트워크 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  }

  const isEditing = (s: SectionKey) => editingSection === s;

  return (
    <div className="space-y-5 pb-10">
      {/* 학력 */}
      <Section
        title="학력"
        count={educations.length}
        isEditing={isEditing("educations")}
        onEdit={() => startEdit("educations")}
        onAdd={() => setEducations((p) => [...p, newEducation()])}
        onSave={() => saveSection("educations")}
        onCancel={() => cancelEdit("educations")}
        saving={saving}
        saveError={isEditing("educations") ? saveError : ""}
      >
        {educations.length === 0 ? (
          <EmptyState text="학력 정보가 없습니다" />
        ) : educations.map((edu, i) => (
          <ItemCard key={i} onDelete={isEditing("educations") ? () => setEducations((p) => p.filter((_, idx) => idx !== i)) : undefined}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isEditing("educations") ? (
                <>
                  <Field label="학교명">
                    <input type="text" value={edu.schoolName} onChange={(e) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, schoolName: e.target.value } : item))} placeholder="OO대학교" className="input" />
                  </Field>
                  <Field label="전공">
                    <input type="text" value={edu.major} onChange={(e) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, major: e.target.value } : item))} placeholder="컴퓨터공학" className="input" />
                  </Field>
                  <Field label="학위">
                    <CustomSelect
                      value={edu.degree}
                      options={["학사", "석사", "박사"]}
                      onChange={(v) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, degree: v as Education["degree"] } : item))}
                    />
                  </Field>
                  <Field label="졸업상태">
                    <CustomSelect
                      value={edu.graduationStatus}
                      options={["재학중", "졸업", "졸업예정", "중퇴", "휴학중"]}
                      onChange={(v) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, graduationStatus: v as Education["graduationStatus"] } : item))}
                    />
                  </Field>
                  <Field label="입학일">
                    <MonthPicker value={edu.startDate} onChange={(v) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, startDate: v } : item))} />
                  </Field>
                  <Field label="졸업일">
                    <MonthPicker value={edu.endDate ?? ""} onChange={(v) => setEducations((p) => p.map((item, idx) => idx === i ? { ...item, endDate: v } : item))} />
                  </Field>
                </>
              ) : (
                <>
                  <ViewField label="학교명" value={edu.schoolName} />
                  <ViewField label="전공" value={edu.major} />
                  <ViewField label="학위" value={edu.degree} />
                  <ViewField label="졸업상태" value={edu.graduationStatus} />
                  <ViewField label="입학일" value={edu.startDate} />
                  <ViewField label="졸업일" value={edu.endDate} />

                </>
              )}
            </div>
          </ItemCard>
        ))}
      </Section>

      {/* 경력 */}
      <Section
        title="경력"
        count={careers.length}
        isEditing={isEditing("careers")}
        onEdit={() => startEdit("careers")}
        onAdd={() => setCareers((p) => [...p, newCareer()])}
        onSave={() => saveSection("careers")}
        onCancel={() => cancelEdit("careers")}
        saving={saving}
        saveError={isEditing("careers") ? saveError : ""}
      >
        {careers.length === 0 ? (
          <EmptyState text="경력 정보가 없습니다" />
        ) : careers.map((career, i) => (
          <ItemCard key={i} onDelete={isEditing("careers") ? () => setCareers((p) => p.filter((_, idx) => idx !== i)) : undefined}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isEditing("careers") ? (
                <>
                  <Field label="회사명">
                    <input type="text" value={career.companyName} onChange={(e) => setCareers((p) => p.map((item, idx) => idx === i ? { ...item, companyName: e.target.value } : item))} placeholder="(주)OO회사" className="input" />
                  </Field>
                  <Field label="직무">
                    <input type="text" value={career.role} onChange={(e) => setCareers((p) => p.map((item, idx) => idx === i ? { ...item, role: e.target.value } : item))} placeholder="백엔드 개발자" className="input" />
                  </Field>
                  <Field label="시작일">
                    <MonthPicker value={career.startDate} onChange={(v) => setCareers((p) => p.map((item, idx) => idx === i ? { ...item, startDate: v } : item))} />
                  </Field>
                  <Field label="종료일">
                    <MonthPicker value={career.endDate ?? ""} onChange={(v) => setCareers((p) => p.map((item, idx) => idx === i ? { ...item, endDate: v } : item))} />
                  </Field>
                </>
              ) : (
                <>
                  <ViewField label="회사명" value={career.companyName} />
                  <ViewField label="직무" value={career.role} />
                  <ViewField label="시작일" value={career.startDate} />
                  <ViewField label="종료일" value={career.endDate} />
                </>
              )}
            </div>
            {isEditing("careers") ? (
              <Field label="업무 설명">
                <textarea value={career.description ?? ""} onChange={(e) => setCareers((p) => p.map((item, idx) => idx === i ? { ...item, description: e.target.value } : item))} placeholder="주요 업무 내용을 간략히 적어주세요" rows={2} className="input resize-none" />
              </Field>
            ) : (
              career.description ? <ViewField label="업무 설명" value={career.description} /> : null
            )}
          </ItemCard>
        ))}
      </Section>

      {/* 자격증 */}
      <Section
        title="자격증"
        count={certifications.length}
        isEditing={isEditing("certifications")}
        onEdit={() => startEdit("certifications")}
        onAdd={() => setCertifications((p) => [...p, newCertification()])}
        onSave={() => saveSection("certifications")}
        onCancel={() => cancelEdit("certifications")}
        saving={saving}
        saveError={isEditing("certifications") ? saveError : ""}
      >
        {certifications.length === 0 ? (
          <EmptyState text="자격증 정보가 없습니다" />
        ) : certifications.map((cert, i) => (
          <ItemCard key={i} onDelete={isEditing("certifications") ? () => setCertifications((p) => p.filter((_, idx) => idx !== i)) : undefined}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isEditing("certifications") ? (
                <>
                  <Field label="자격증명">
                    <input type="text" value={cert.name} onChange={(e) => setCertifications((p) => p.map((item, idx) => idx === i ? { ...item, name: e.target.value } : item))} placeholder="정보처리기사" className="input" />
                  </Field>
                  <Field label="등급 / 점수 (선택)">
                    <input type="text" value={cert.grade ?? ""} onChange={(e) => setCertifications((p) => p.map((item, idx) => idx === i ? { ...item, grade: e.target.value } : item))} placeholder="예) 1급, 900점" className="input" />
                  </Field>
                </>
              ) : (
                <>
                  <ViewField label="자격증명" value={cert.name} />
                  <ViewField label="등급 / 점수" value={cert.grade} />
                </>
              )}
            </div>
          </ItemCard>
        ))}
      </Section>

      {/* 대외활동 */}
      <Section
        title="대외활동"
        count={activities.length}
        isEditing={isEditing("activities")}
        onEdit={() => startEdit("activities")}
        onAdd={() => setActivities((p) => [...p, newActivity()])}
        onSave={() => saveSection("activities")}
        onCancel={() => cancelEdit("activities")}
        saving={saving}
        saveError={isEditing("activities") ? saveError : ""}
      >
        {activities.length === 0 ? (
          <EmptyState text="대외활동 정보가 없습니다" />
        ) : activities.map((act, i) => (
          <ItemCard key={i} onDelete={isEditing("activities") ? () => setActivities((p) => p.filter((_, idx) => idx !== i)) : undefined}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isEditing("activities") ? (
                <>
                  <Field label="활동명">
                    <input type="text" value={act.title} onChange={(e) => setActivities((p) => p.map((item, idx) => idx === i ? { ...item, title: e.target.value } : item))} placeholder="UX 스터디" className="input" />
                  </Field>
                  <Field label="역할">
                    <input type="text" value={act.role} onChange={(e) => setActivities((p) => p.map((item, idx) => idx === i ? { ...item, role: e.target.value } : item))} placeholder="팀장" className="input" />
                  </Field>
                  <Field label="시작일">
                    <MonthPicker value={act.startDate} onChange={(v) => setActivities((p) => p.map((item, idx) => idx === i ? { ...item, startDate: v } : item))} />
                  </Field>
                  <Field label="종료일">
                    <MonthPicker value={act.endDate ?? ""} onChange={(v) => setActivities((p) => p.map((item, idx) => idx === i ? { ...item, endDate: v } : item))} />
                  </Field>
                </>
              ) : (
                <>
                  <ViewField label="활동명" value={act.title} />
                  <ViewField label="역할" value={act.role} />
                  <ViewField label="시작일" value={act.startDate} />
                  <ViewField label="종료일" value={act.endDate} />
                </>
              )}
            </div>
            {isEditing("activities") ? (
              <Field label="활동 설명">
                <textarea value={act.description ?? ""} onChange={(e) => setActivities((p) => p.map((item, idx) => idx === i ? { ...item, description: e.target.value } : item))} placeholder="활동 내용을 간략히 적어주세요" rows={2} className="input resize-none" />
              </Field>
            ) : (
              act.description ? <ViewField label="활동 설명" value={act.description} /> : null
            )}
          </ItemCard>
        ))}
      </Section>
    </div>
  );
}

// ── 하위 컴포넌트 ──────────────────────────────────────────

function Section({
  title, count, isEditing, onEdit, onAdd, onSave, onCancel, saving, saveError, children,
}: {
  title: string;
  count: number;
  isEditing: boolean;
  onEdit: () => void;
  onAdd?: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveError: string;
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
        <div className="flex items-center gap-1">
          {isEditing ? (
            onAdd && (
              <button
                onClick={onAdd}
                className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                추가
              </button>
            )
          ) : (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              <PencilIcon />
            </button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">{children}</div>
      {isEditing && (
        <div className="px-4 pb-4 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-slate-700 pt-3">
          {saveError && <p className="text-red-500 text-sm flex-1">{saveError}</p>}
          <button onClick={onCancel} className="btn-secondary">취소</button>
          <button onClick={onSave} disabled={saving} className="btn-primary px-6">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      )}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="2" x2="22" y2="6" />
      <path d="M7.5 20.5 2 22l1.5-5.5L17 3a2.828 2.828 0 1 1 4 4L7.5 20.5z" />
    </svg>
  );
}

function ItemCard({ children, onDelete }: { children: React.ReactNode; onDelete?: () => void }) {
  return (
    <div className="relative rounded-xl border border-gray-100 dark:border-slate-600 bg-gray-50/60 dark:bg-slate-700/30 p-4 space-y-3">
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          aria-label="삭제"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
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
      <label className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</p>
      <p className="text-sm text-gray-900 dark:text-slate-100">{value || "—"}</p>
    </div>
  );
}
