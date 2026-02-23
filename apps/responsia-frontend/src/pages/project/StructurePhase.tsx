import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  IconButton,
  TextField,
  Divider,
  CircularProgress,
} from '@mui/material'
import {
  Upload,
  Play,
  FileText,
  Sparkles,
  X,
  Plus,
  Trash2,
  GripVertical,
  Edit3,
  Check,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import {
  useDocuments,
  useUploadDocument,
  useStartSetup,
  useOutline,
  useAnalyzeStructure,
  useCreateOutlineSection,
  useUpdateOutlineSection,
  useDeleteOutlineSection,
  useReorderOutline,
} from '../../hooks/useApi'
import { customInstance, AXIOS_INSTANCE } from '../../api/mutator'
import { useSSE } from '../../hooks/useSSE'

const FILE_TYPES = ['rfp', 'past_submission', 'reference', 'analysis_report', 'template'] as const

const FILE_TYPE_COLORS: Record<string, 'primary' | 'secondary' | 'info' | 'warning' | 'success'> = {
  rfp: 'primary',
  past_submission: 'info',
  reference: 'secondary',
  analysis_report: 'warning',
  template: 'success',
}

interface PendingFile {
  file: File
  fileType: string
  classifying: boolean
}

interface Props {
  projectId: number
}

export const StructurePhase = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const { data: documents, refetch: refetchDocs } = useDocuments(projectId)
  const uploadDoc = useUploadDocument(projectId)
  const startSetup = useStartSetup(projectId)
  const { data: outline, refetch: refetchOutline } = useOutline(projectId)
  const analyzeStructure = useAnalyzeStructure(projectId)
  const createSection = useCreateOutlineSection(projectId)
  const updateSection = useUpdateOutlineSection()
  const deleteSection = useDeleteOutlineSection()
  const reorderOutline = useReorderOutline(projectId)
  useSSE()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFileType, setSelectedFileType] = useState<string>('rfp')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [progress, setProgress] = useState<any[]>([])
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)

  // Outline editing state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')

  // Batch upload: select files -> auto-classify -> show preview -> confirm & upload
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const fileList = Array.from(files)

    // Immediately show files with selectedFileType as default
    const pending: PendingFile[] = fileList.map((f) => ({
      file: f,
      fileType: selectedFileType,
      classifying: true,
    }))
    setPendingFiles((prev) => [...prev, ...pending])
    if (fileInputRef.current) fileInputRef.current.value = ''

    // Auto-classify in background
    try {
      const filenames = fileList.map((f) => f.name)
      const result = await customInstance<{ classifications: Record<string, string> }>({
        url: '/api/v1/documents/classify',
        method: 'POST',
        data: { filenames },
      })
      setPendingFiles((prev) =>
        prev.map((pf) => {
          const classified = result.classifications[pf.file.name]
          if (classified && classified !== 'other') {
            return { ...pf, fileType: classified, classifying: false }
          }
          return { ...pf, classifying: false }
        }),
      )
    } catch {
      enqueueSnackbar(t('errors.classifyFailed'), { variant: 'warning' })
      setPendingFiles((prev) => prev.map((pf) => ({ ...pf, classifying: false })))
    }
  }

  const handleUploadPending = async () => {
    setUploading(true)
    try {
      for (const pf of pendingFiles) {
        const formData = new FormData()
        formData.append('file', pf.file)
        formData.append('fileType', pf.fileType)
        await uploadDoc.mutateAsync(formData)
      }
      setPendingFiles([])
      refetchDocs()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const updatePendingType = (index: number, newType: string) => {
    setPendingFiles((prev) =>
      prev.map((pf, i) => (i === index ? { ...pf, fileType: newType } : pf)),
    )
  }

  const handleStartAnalysis = async () => {
    setConfirmOpen(false)
    await startSetup.mutateAsync()

    // SSE progress stream
    const baseUrl = AXIOS_INSTANCE.defaults.baseURL
    const eventSource = new EventSource(`${baseUrl}/api/v1/projects/${projectId}/setup/progress`)
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'progress') setProgress(data.jobs)
      if (data.type === 'done') eventSource.close()
    }
    eventSource.onerror = () => eventSource.close()
  }

  // Outline actions
  const handleAnalyzeStructure = async () => {
    try {
      await analyzeStructure.mutateAsync()
      refetchOutline()
      enqueueSnackbar(t('project.structure.analyzeBtn') + ' - OK', { variant: 'success' })
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const handleAddSection = async () => {
    if (!newTitle.trim()) return
    try {
      await createSection.mutateAsync({ title: newTitle, description: newDescription })
      setNewTitle('')
      setNewDescription('')
      setAddingNew(false)
      refetchOutline()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const handleUpdateSection = async (id: number) => {
    try {
      await updateSection.mutateAsync({ id, title: editTitle, description: editDescription })
      setEditingId(null)
      refetchOutline()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const handleDeleteSection = async (id: number) => {
    try {
      await deleteSection.mutateAsync(id)
      refetchOutline()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const handleMoveSection = async (index: number, direction: 'up' | 'down') => {
    if (!outline) return
    const sorted = [...outline].sort((a: any, b: any) => a.sortOrder - b.sortOrder)
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= sorted.length) return

    const reordered = sorted.map((s: any, i: number) => ({
      id: s.id,
      sortOrder: i === index ? newIndex : i === newIndex ? index : i,
    }))
    try {
      await reorderOutline.mutateAsync(reordered)
      refetchOutline()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const startEditing = (section: any) => {
    setEditingId(section.id)
    setEditTitle(section.title)
    setEditDescription(section.description || '')
  }

  const sortedOutline = [...(outline || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder)

  return (
    <Box>
      {/* Upload section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('setup.uploadTitle')}
          </Typography>

          {/* Batch upload with auto-classify */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Sparkles size={18} strokeWidth={1} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadDoc.isPending || uploading}
            >
              {t('setup.batchUpload')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={handleFilesSelected}
              accept=".pdf,.docx,.xlsx,.xls,.txt,.csv"
            />
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {t('setup.batchUploadHint')}
            </Typography>
          </Box>

          {/* Pending files preview (classified but not yet uploaded) */}
          {pendingFiles.length > 0 && (
            <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('setup.pendingFiles', { count: pendingFiles.length })}
              </Typography>
              <List dense>
                {pendingFiles.map((pf, i) => (
                  <ListItem key={i} sx={{ py: 0.5 }}>
                    <FileText size={16} strokeWidth={1} style={{ marginRight: 8 }} />
                    <ListItemText
                      primary={pf.file.name}
                      secondary={pf.classifying ? t('setup.classifying') : undefined}
                    />
                    <Select
                      value={pf.fileType}
                      onChange={(e) => updatePendingType(i, e.target.value)}
                      size="small"
                      sx={{ minWidth: 160, mr: 1 }}
                      disabled={pf.classifying}
                    >
                      {FILE_TYPES.map((ft) => (
                        <MenuItem key={ft} value={ft}>
                          {t(`documents.types.${ft}`)}
                        </MenuItem>
                      ))}
                    </Select>
                    <ListItemSecondaryAction>
                      <IconButton edge="end" size="small" onClick={() => removePending(i)}>
                        <X size={16} strokeWidth={1} />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleUploadPending}
                  disabled={uploading || pendingFiles.some((pf) => pf.classifying)}
                  startIcon={<Upload size={16} strokeWidth={1} />}
                >
                  {uploading ? t('common.loading') : t('setup.confirmUpload')}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setPendingFiles([])}
                  disabled={uploading}
                >
                  {t('common.cancel')}
                </Button>
              </Box>
            </Card>
          )}

          {/* Document list */}
          <List dense>
            {(documents || []).map((doc: any) => (
              <ListItem key={doc.id}>
                <FileText size={18} strokeWidth={1} style={{ marginRight: 8 }} />
                <ListItemText
                  primary={doc.filename}
                  secondary={`${doc.pageCount || 0} pages`}
                />
                <Chip
                  label={t(`documents.types.${doc.fileType}`)}
                  color={FILE_TYPE_COLORS[doc.fileType] || 'default'}
                  size="small"
                  sx={{ mr: 1 }}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Outline section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {t('project.structure.title')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={analyzeStructure.isPending ? <CircularProgress size={16} /> : <Sparkles size={16} strokeWidth={1} />}
                onClick={handleAnalyzeStructure}
                disabled={!documents?.length || analyzeStructure.isPending}
              >
                {analyzeStructure.isPending ? t('project.structure.analyzing') : t('project.structure.analyzeBtn')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<Plus size={16} strokeWidth={1} />}
                onClick={() => setAddingNew(true)}
              >
                {t('project.structure.addSection')}
              </Button>
            </Box>
          </Box>

          {/* Add new section form */}
          {addingNew && (
            <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
              <TextField
                size="small"
                fullWidth
                label={t('drafting.title')}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                sx={{ mb: 1 }}
              />
              <TextField
                size="small"
                fullWidth
                label={t('project.description')}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                multiline
                minRows={2}
                sx={{ mb: 1 }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="contained" onClick={handleAddSection} disabled={!newTitle.trim()}>
                  {t('common.save')}
                </Button>
                <Button size="small" variant="outlined" onClick={() => { setAddingNew(false); setNewTitle(''); setNewDescription('') }}>
                  {t('common.cancel')}
                </Button>
              </Box>
            </Card>
          )}

          {/* Outline list */}
          {sortedOutline.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              {t('project.structure.noSections')}
            </Typography>
          ) : (
            <List dense>
              {sortedOutline.map((section: any, index: number) => (
                <Box key={section.id}>
                  {index > 0 && <Divider />}
                  <ListItem sx={{ py: 1, alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', mr: 1, mt: 0.5 }}>
                      <IconButton
                        size="small"
                        disabled={index === 0}
                        onClick={() => handleMoveSection(index, 'up')}
                      >
                        <ChevronUp size={14} strokeWidth={1} />
                      </IconButton>
                      <IconButton
                        size="small"
                        disabled={index === sortedOutline.length - 1}
                        onClick={() => handleMoveSection(index, 'down')}
                      >
                        <ChevronDown size={14} strokeWidth={1} />
                      </IconButton>
                    </Box>

                    {editingId === section.id ? (
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          size="small"
                          fullWidth
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          sx={{ mb: 1 }}
                        />
                        <TextField
                          size="small"
                          fullWidth
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          multiline
                          minRows={2}
                          sx={{ mb: 1 }}
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton size="small" onClick={() => handleUpdateSection(section.id)}>
                            <Check size={16} strokeWidth={1} />
                          </IconButton>
                          <IconButton size="small" onClick={() => setEditingId(null)}>
                            <X size={16} strokeWidth={1} />
                          </IconButton>
                        </Box>
                      </Box>
                    ) : (
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2">
                            {section.numbering ? `${section.numbering} ` : ''}{section.title}
                          </Typography>
                        }
                        secondary={section.description}
                        sx={{ flex: 1 }}
                      />
                    )}

                    {editingId !== section.id && (
                      <ListItemSecondaryAction>
                        <IconButton size="small" onClick={() => startEditing(section)}>
                          <Edit3 size={16} strokeWidth={1} />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteSection(section.id)}>
                          <Trash2 size={16} strokeWidth={1} />
                        </IconButton>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                </Box>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Start analysis */}
      <Button
        variant="contained"
        size="large"
        startIcon={<Play size={18} strokeWidth={1} />}
        onClick={() => setConfirmOpen(true)}
        disabled={!documents?.length || startSetup.isPending}
      >
        {t('setup.startAnalysis')}
      </Button>

      {/* Progress cards */}
      {progress.length > 0 && (
        <Box sx={{ mt: 3 }}>
          {progress.map((job: any) => (
            <Card key={job.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2">{t(`setup.jobs.${job.jobType}`)}</Typography>
                  <Chip
                    label={job.status}
                    color={job.status === 'completed' ? 'success' : job.status === 'error' ? 'error' : 'warning'}
                    size="small"
                  />
                </Box>
                <LinearProgress variant="determinate" value={job.progress} sx={{ mb: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {job.message}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{t('setup.confirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('setup.confirmMessage', { count: documents?.length || 0 })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleStartAnalysis}>
            {t('setup.start')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
