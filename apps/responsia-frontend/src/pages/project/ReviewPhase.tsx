import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Divider,
  TextField,
  Checkbox,
  FormControlLabel,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material'
import { ShieldCheck, Download, FileUp, AlertTriangle } from 'lucide-react'
import { useSnackbar } from 'notistack'
import {
  useCompliance,
  useExport,
  useDraftGroups,
  useOutline,
  useExtractedItems,
  useUpdateDraftGroup,
  useUpdateItem,
} from '../../hooks/useApi'

interface Props {
  projectId: number
}

export const ReviewPhase = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const { data: draftGroups, refetch: refetchGroups } = useDraftGroups(projectId)
  const { data: outline } = useOutline(projectId)
  const { data: items, refetch: refetchItems } = useExtractedItems(projectId)
  const complianceMutation = useCompliance(projectId)
  const exportMutation = useExport(projectId)
  const updateDraftGroup = useUpdateDraftGroup()
  const updateItem = useUpdateItem()

  const [report, setReport] = useState<any>(null)
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  const handleCompliance = async () => {
    try {
      const result = await complianceMutation.mutateAsync()
      setReport(result)
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const handleExport = async (format: 'clean' | 'template') => {
    try {
      const blob = await exportMutation.mutateAsync(format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'template'
        ? `reponse-ao-${projectId}-template.docx`
        : `reponse-ao-${projectId}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      enqueueSnackbar(err?.response?.data?.message || t('errors.http.generic'), { variant: 'error' })
    }
  }

  const handleStartEdit = (group: any) => {
    setEditingSectionId(group.id)
    setEditText(group.generatedText || '')
  }

  const handleSaveEdit = async (groupId: number) => {
    try {
      await updateDraftGroup.mutateAsync({ id: groupId, generatedText: editText })
      setEditingSectionId(null)
      refetchGroups()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const handleToggleCondition = async (item: any) => {
    try {
      await updateItem.mutateAsync({ id: item.id, addressed: !item.addressed })
      refetchItems()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  // Stats
  const totalConditions = (items || []).filter((i: any) => i.itemType === 'condition').length
  const addressedConditions = (items || []).filter((i: any) => i.itemType === 'condition' && i.addressed).length
  const totalGroups = draftGroups?.length || 0
  const draftedGroups = (draftGroups || []).filter((g: any) => g.generatedText).length
  const coveragePercent = totalGroups > 0 ? Math.round((draftedGroups / totalGroups) * 100) : 0
  const qualityScore = report?.qualityScore ?? null
  const pendingCount = totalConditions - addressedConditions

  // Build section cards from outline + draft groups
  const sortedOutline = [...(outline || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder)

  const getSectionGroup = (sectionId: number) =>
    (draftGroups || []).find((g: any) => g.outlineSectionId === sectionId)

  const getSectionConditions = (sectionId: number) =>
    (items || []).filter((i: any) => i.outlineSectionId === sectionId && i.itemType === 'condition')

  return (
    <Box>
      {/* Stats cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="primary">{coveragePercent}%</Typography>
            <Typography variant="body2" color="text.secondary">{t('project.review.coverage')}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color={qualityScore !== null ? 'success.main' : 'text.disabled'}>
              {qualityScore !== null ? `${qualityScore}%` : '--'}
            </Typography>
            <Typography variant="body2" color="text.secondary">{t('project.review.quality')}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color={pendingCount > 0 ? 'warning.main' : 'success.main'}>
              {pendingCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">{t('project.review.pending')}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={complianceMutation.isPending ? <CircularProgress size={18} /> : <ShieldCheck size={18} strokeWidth={1} />}
          onClick={handleCompliance}
          disabled={complianceMutation.isPending}
        >
          {t('project.review.compliance')}
        </Button>
        <Button
          variant="outlined"
          startIcon={<Download size={18} strokeWidth={1} />}
          onClick={() => handleExport('clean')}
          disabled={exportMutation.isPending}
        >
          {t('project.review.exportClean')}
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileUp size={18} strokeWidth={1} />}
          onClick={() => handleExport('template')}
          disabled={exportMutation.isPending}
        >
          {t('project.review.exportTemplate')}
        </Button>
      </Box>

      {/* Compliance report */}
      {report && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('review.complianceReport')}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {report.summary}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('project.review.coverage')}: {report.coveragePercent}%
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

      {/* Document preview */}
      <Typography variant="h6" gutterBottom>
        {t('project.review.documentPreview')}
      </Typography>

      {sortedOutline.map((section: any) => {
        const group = getSectionGroup(section.id)
        const conditions = getSectionConditions(section.id)
        const isEditing = editingSectionId === group?.id

        return (
          <Paper key={section.id} sx={{ mb: 2, p: 3 }}>
            {/* Section header */}
            <Typography variant="h6" sx={{ mb: 1 }}>
              {section.numbering ? `${section.numbering} ` : ''}{section.title}
            </Typography>

            {section.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {section.description}
              </Typography>
            )}

            <Divider sx={{ mb: 2 }} />

            {/* Section body - generated text or inline editor */}
            {group ? (
              isEditing ? (
                <Box>
                  <TextField
                    multiline
                    minRows={6}
                    maxRows={20}
                    fullWidth
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button size="small" variant="contained" onClick={() => handleSaveEdit(group.id)}>
                      {t('common.save')}
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => setEditingSectionId(null)}>
                      {t('common.cancel')}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography
                  variant="body1"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover', borderRadius: 1 },
                    p: 1,
                    minHeight: 40,
                  }}
                  onClick={() => handleStartEdit(group)}
                  title={t('project.review.editSection')}
                >
                  {group.generatedText || (
                    <Typography component="span" color="text.secondary" fontStyle="italic">
                      {t('drafting.responsePlaceholder')}
                    </Typography>
                  )}
                </Typography>
              )
            ) : (
              <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{ p: 1 }}>
                {t('drafting.responsePlaceholder')}
              </Typography>
            )}

            {/* Conditions checklist */}
            {conditions.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="subtitle2" gutterBottom>
                  {t('project.extract.conditions')} ({conditions.filter((c: any) => c.addressed).length}/{conditions.length})
                </Typography>
                {conditions.map((cond: any) => (
                  <FormControlLabel
                    key={cond.id}
                    control={
                      <Checkbox
                        checked={!!cond.addressed}
                        onChange={() => handleToggleCondition(cond)}
                        size="small"
                      />
                    }
                    label={
                      <Typography
                        variant="body2"
                        sx={{ textDecoration: cond.addressed ? 'line-through' : 'none', color: cond.addressed ? 'text.secondary' : 'text.primary' }}
                      >
                        {cond.text}
                      </Typography>
                    }
                    sx={{ display: 'block', ml: 0 }}
                  />
                ))}
              </Box>
            )}
          </Paper>
        )
      })}
    </Box>
  )
}
