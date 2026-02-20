import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
} from '@mui/material'
import { Upload, Play, FileText } from 'lucide-react'
import { useDocuments, useUploadDocument, useStartSetup } from '../../hooks/useApi'
import { useSSE } from '../../hooks/useSSE'

const FILE_TYPES = ['rfp', 'past_submission', 'reference', 'analysis_report', 'template'] as const

const FILE_TYPE_COLORS: Record<string, 'primary' | 'secondary' | 'info' | 'warning' | 'success'> = {
  rfp: 'primary',
  past_submission: 'info',
  reference: 'secondary',
  analysis_report: 'warning',
  template: 'success',
}

interface Props {
  projectId: number
}

export const SetupPhase = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const { data: documents } = useDocuments(projectId)
  const uploadDoc = useUploadDocument(projectId)
  const startSetup = useStartSetup(projectId)
  useSSE()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFileType, setSelectedFileType] = useState<string>('rfp')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [progress, setProgress] = useState<any[]>([])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileType', selectedFileType)
      await uploadDoc.mutateAsync(formData)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleStartAnalysis = async () => {
    setConfirmOpen(false)
    await startSetup.mutateAsync()

    // SSE progress stream
    const baseUrl = (await import('../../api/mutator')).AXIOS_INSTANCE.defaults.baseURL
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
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Select
              value={selectedFileType}
              onChange={(e) => setSelectedFileType(e.target.value)}
              size="small"
            >
              {FILE_TYPES.map((ft) => (
                <MenuItem key={ft} value={ft}>
                  {t(`documents.types.${ft}`)}
                </MenuItem>
              ))}
            </Select>
            <Button
              variant="outlined"
              startIcon={<Upload size={18} strokeWidth={1} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadDoc.isPending}
            >
              {t('setup.upload')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={handleUpload}
              accept=".pdf,.docx,.xlsx,.xls,.txt,.csv"
            />
          </Box>

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
