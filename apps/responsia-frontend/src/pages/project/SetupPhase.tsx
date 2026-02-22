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
} from '@mui/material'
import { Upload, Play, FileText, Sparkles, X } from 'lucide-react'
import { useDocuments, useUploadDocument, useStartSetup } from '../../hooks/useApi'
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

export const SetupPhase = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const { data: documents, refetch: refetchDocs } = useDocuments(projectId)
  const uploadDoc = useUploadDocument(projectId)
  const startSetup = useStartSetup(projectId)
  useSSE()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFileType, setSelectedFileType] = useState<string>('rfp')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [progress, setProgress] = useState<any[]>([])
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)

  // Batch upload: select files → auto-classify → show preview → confirm & upload
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
