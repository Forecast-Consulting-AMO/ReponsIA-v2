import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customInstance } from '../api/mutator'

// --- Projects ---

export const useProjects = () =>
  useQuery({
    queryKey: ['projects'],
    queryFn: () => customInstance<any[]>({ url: '/api/v1/projects', method: 'GET' }),
  })

export const useProject = (id: number) =>
  useQuery({
    queryKey: ['project', id],
    queryFn: () => customInstance<any>({ url: `/api/v1/projects/${id}`, method: 'GET' }),
    enabled: !!id,
  })

export const useCreateProject = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; contentLanguage?: string }) =>
      customInstance<any>({ url: '/api/v1/projects', method: 'POST', data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export const useDeleteProject = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      customInstance<any>({ url: `/api/v1/projects/${id}`, method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

// --- Documents ---

export const useDocuments = (projectId: number) =>
  useQuery({
    queryKey: ['documents', projectId],
    queryFn: () =>
      customInstance<any[]>({ url: `/api/v1/projects/${projectId}/documents`, method: 'GET' }),
    enabled: !!projectId,
  })

export const useUploadDocument = (projectId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) =>
      customInstance<any>({
        url: `/api/v1/projects/${projectId}/documents`,
        method: 'POST',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', projectId] }),
  })
}

// --- Requirements ---

export const useRequirements = (projectId: number) =>
  useQuery({
    queryKey: ['requirements', projectId],
    queryFn: () =>
      customInstance<any[]>({ url: `/api/v1/projects/${projectId}/requirements`, method: 'GET' }),
    enabled: !!projectId,
  })

export const useUpdateRequirement = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; [key: string]: any }) =>
      customInstance<any>({ url: `/api/v1/requirements/${id}`, method: 'PUT', data }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['requirements'] }),
  })
}

// --- Feedback ---

export const useFeedback = (projectId: number) =>
  useQuery({
    queryKey: ['feedback', projectId],
    queryFn: () =>
      customInstance<any[]>({ url: `/api/v1/projects/${projectId}/feedback`, method: 'GET' }),
    enabled: !!projectId,
  })

// --- Knowledge ---

export const useKnowledge = (projectId: number) =>
  useQuery({
    queryKey: ['knowledge', projectId],
    queryFn: () =>
      customInstance<any[]>({ url: `/api/v1/projects/${projectId}/knowledge`, method: 'GET' }),
    enabled: !!projectId,
  })

// --- Chat ---

export const useChatHistory = (projectId: number) =>
  useQuery({
    queryKey: ['chat', projectId],
    queryFn: () =>
      customInstance<any[]>({ url: `/api/v1/projects/${projectId}/chat`, method: 'GET' }),
    enabled: !!projectId,
  })

// --- Setup ---

export const useStartSetup = (projectId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      customInstance<any>({ url: `/api/v1/projects/${projectId}/setup/start`, method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requirements', projectId] })
      qc.invalidateQueries({ queryKey: ['knowledge', projectId] })
      qc.invalidateQueries({ queryKey: ['feedback', projectId] })
    },
  })
}

// --- Compliance ---

export const useCompliance = (projectId: number) =>
  useMutation({
    mutationFn: () =>
      customInstance<any>({ url: `/api/v1/projects/${projectId}/compliance`, method: 'POST' }),
  })

// --- Export ---

export const useExport = (projectId: number) =>
  useMutation({
    mutationFn: (format: 'clean' | 'template' = 'clean') =>
      customInstance<Blob>({
        url: `/api/v1/projects/${projectId}/export`,
        method: 'POST',
        data: { format },
        responseType: 'blob',
      }),
  })

// --- Settings ---

export const useModels = () =>
  useQuery({
    queryKey: ['models'],
    queryFn: () => customInstance<any>({ url: '/api/v1/settings/models', method: 'GET' }),
  })

export const usePreferences = () =>
  useQuery({
    queryKey: ['preferences'],
    queryFn: () => customInstance<any>({ url: '/api/v1/settings/preferences', method: 'GET' }),
  })

export const useUpdatePreferences = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { models?: Record<string, string>; prompts?: Record<string, string> }) =>
      customInstance<any>({ url: '/api/v1/settings/preferences', method: 'PUT', data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preferences'] }),
  })
}

// --- Auth ---

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => customInstance<any>({ url: '/api/v1/auth/me', method: 'GET' }),
  })
