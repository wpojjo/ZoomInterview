import { z } from "zod";

export const educationSchema = z.object({
  id: z.string().optional(),
  schoolName: z.string().min(1, "학교명을 입력해주세요"),
  major: z.string().min(1, "전공을 입력해주세요"),
  startDate: z.string().min(1, "시작일을 입력해주세요"),
  endDate: z.string().optional(),
  graduationStatus: z.enum(["재학중", "졸업", "졸업예정", "중퇴", "휴학중"], {
    errorMap: () => ({ message: "졸업상태를 선택해주세요" }),
  }),
});

export const careerSchema = z.object({
  id: z.string().optional(),
  companyName: z.string().min(1, "회사명을 입력해주세요"),
  role: z.string().min(1, "직무를 입력해주세요"),
  startDate: z.string().min(1, "시작일을 입력해주세요"),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

export const certificationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "자격증명을 입력해주세요"),
  acquiredDate: z.string().min(1, "취득일을 입력해주세요"),
});

export const activitySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "활동명을 입력해주세요"),
  role: z.string().min(1, "역할을 입력해주세요"),
  startDate: z.string().min(1, "시작일을 입력해주세요"),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

export const profileSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  educations: z.array(educationSchema).default([]),
  careers: z.array(careerSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
  activities: z.array(activitySchema).default([]),
});

export const jobPostingSchema = z.object({
  sourceUrl: z.string().url("올바른 URL을 입력해주세요"),
});

export const jobPostingAnalysisSchema = z.object({
  responsibilities: z.string(),
  requirements:     z.string(),
  preferredQuals:   z.string(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type JobPostingInput = z.infer<typeof jobPostingSchema>;
export type JobPostingAnalysis = z.infer<typeof jobPostingAnalysisSchema>;
