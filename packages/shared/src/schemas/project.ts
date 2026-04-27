import { z } from "zod";

const SlugSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "slug must be lowercase alphanumeric with hyphens");

export const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: SlugSchema,
});
export type CreateOrgRequest = z.infer<typeof CreateOrgSchema>;

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string().datetime(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const CreateProjectSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1).max(100),
  slug: SlugSchema,
});
export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;
