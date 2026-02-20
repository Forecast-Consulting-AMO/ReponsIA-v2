import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
} from '@mui/material'
import { ShieldCheck, Download, AlertTriangle } from 'lucide-react'
import { useCompliance, useExport, useRequirements } from '../../hooks/useApi'

interface Props {
  projectId: number
}

export const ReviewPhase = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const { data: requirements } = useRequirements(projectId)
  const complianceMutation = useCompliance(projectId)
  const exportMutation = useExport(projectId)
  const [report, setReport] = useState<any>(null)

  const handleCompliance = async () => {
    const result = await complianceMutation.mutateAsync()
    setReport(result)
  }

  const handleExport = async () => {
    const blob = await exportMutation.mutateAsync('clean')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reponse-ao-${projectId}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Quick stats
  const total = requirements?.length || 0
  const responded = requirements?.filter((r: any) => r.responseStatus !== 'pending').length || 0
  const finalCount = requirements?.filter((r: any) => r.responseStatus === 'final').length || 0

  return (
    <Box>
      {/* Stats overview */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="primary">{responded}/{total}</Typography>
            <Typography variant="body2" color="text.secondary">{t('review.responded')}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="success.main">{finalCount}</Typography>
            <Typography variant="body2" color="text.secondary">{t('review.finalized')}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color={report ? 'primary' : 'text.disabled'}>
              {report ? `${report.qualityScore}%` : '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">{t('review.qualityScore')}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<ShieldCheck size={18} strokeWidth={1} />}
          onClick={handleCompliance}
          disabled={complianceMutation.isPending}
        >
          {complianceMutation.isPending ? <CircularProgress size={20} /> : t('review.checkCompliance')}
        </Button>
        <Button
          variant="outlined"
          startIcon={<Download size={18} strokeWidth={1} />}
          onClick={handleExport}
          disabled={exportMutation.isPending}
        >
          {t('review.exportDocx')}
        </Button>
      </Box>

      {/* Compliance report */}
      {report && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('review.complianceReport')}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {report.summary}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('review.coverage')}: {report.coveragePercent}%
            </Typography>

            {report.warnings?.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  {t('review.warnings')} ({report.warnings.length})
                </Typography>
                <List dense>
                  {report.warnings.map((w: any, i: number) => (
                    <ListItem key={i}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <AlertTriangle size={16} strokeWidth={1} />
                      </ListItemIcon>
                      <ListItemText primary={w.message} />
                      <Chip
                        label={w.severity}
                        size="small"
                        color={w.severity === 'critical' ? 'error' : 'warning'}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
