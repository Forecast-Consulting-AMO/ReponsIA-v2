import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Card,
  CardContent,
  Paper,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material'
import { Wand2, ChevronDown, Settings2 } from 'lucide-react'
import {
  useDraftGroups,
  useUpdateDraftGroup,
  useDraftAll,
  useFeedback,
  useModels,
  useExtractedItems,
} from '../../hooks/useApi'
import { useSSE } from '../../hooks/useSSE'

interface Props {
  projectId: number
}

export const DraftingPhase = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const { data: draftGroups, refetch: refetchGroups } = useDraftGroups(projectId)
  const { data: feedback } = useFeedback(projectId)
  const { data: modelsData } = useModels()
  const { data: items } = useExtractedItems(projectId)
  const updateDraftGroup = useUpdateDraftGroup()
  const draftAll = useDraftAll(projectId)
  const { startStream, isStreaming, streamedText } = useSSE()

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [promptDirty, setPromptDirty] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')

  // Auto-select first group when data loads
  useEffect(() => {
    if (draftGroups?.length && !selectedGroupId) {
      setSelectedGroupId(draftGroups[0].id)
    }
  }, [draftGroups, selectedGroupId])

  // Load selected group data into editor
  const selectedGroup = draftGroups?.find((g: any) => g.id === selectedGroupId) || null

  useEffect(() => {
    if (selectedGroup) {
      setEditText(selectedGroup.generatedText || '')
      setSystemPrompt(selectedGroup.systemPrompt || '')
      setSelectedModel(selectedGroup.model || '')
      setPromptDirty(false)
    }
  }, [selectedGroup?.id, selectedGroup?.generatedText, selectedGroup?.systemPrompt, selectedGroup?.model])

  // Available models
  const models = modelsData?.models || modelsData || []
  const modelList = Array.isArray(models) ? models : Object.keys(models)

  // Items for this section
  const groupItems = selectedGroup
    ? (items || []).filter((item: any) => item.outlineSectionId === selectedGroup.outlineSectionId)
    : []

  // Matched feedback for this section
  const matchedFeedback = selectedGroup
    ? (feedback || []).filter((f: any) => f.outlineSectionId === selectedGroup.outlineSectionId || f.draftGroupId === selectedGroup.id)
    : []

  // Generate single draft via SSE
  const handleGenerate = () => {
    if (!selectedGroup) return
    const body: Record<string, unknown> = {}
    if (selectedModel) body.model = selectedModel
    startStream(`/api/v1/draft-groups/${selectedGroup.id}/generate`, body, {
      onDone: () => {
        refetchGroups()
      },
      onError: (error) => {
        enqueueSnackbar(error || t('errors.draftFailed'), { variant: 'error' })
      },
    })
  }

  // Sync streamed text back to editor when streaming ends
  useEffect(() => {
    if (!isStreaming && streamedText && selectedGroup) {
      setEditText(streamedText)
    }
  }, [isStreaming, streamedText, selectedGroup])

  // Save system prompt
  const handleSavePrompt = async () => {
    if (!selectedGroup) return
    try {
      await updateDraftGroup.mutateAsync({
        id: selectedGroup.id,
        systemPrompt,
      })
      setPromptDirty(false)
      enqueueSnackbar(t('drafting.promptSaved'), { variant: 'success' })
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  // Save edited text
  const handleSaveText = async () => {
    if (!selectedGroup) return
    try {
      await updateDraftGroup.mutateAsync({
        id: selectedGroup.id,
        generatedText: editText,
      })
      refetchGroups()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  // Draft all
  const handleDraftAll = async () => {
    try {
      await draftAll.mutateAsync()
      refetchGroups()
    } catch {
      enqueueSnackbar(t('errors.draftFailed'), { variant: 'error' })
    }
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 200px)' }}>
      {/* Left panel: Section list */}
      <Paper sx={{ width: 250, minWidth: 250, overflow: 'auto' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2">{t('project.drafting.sections')}</Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={draftAll.isPending ? <CircularProgress size={14} /> : <Wand2 size={14} strokeWidth={1} />}
            onClick={handleDraftAll}
            disabled={draftAll.isPending || isStreaming}
          >
            {t('project.drafting.draftAll')}
          </Button>
        </Box>
        <Divider />
        <List dense disablePadding>
          {(draftGroups || []).map((group: any) => (
            <ListItemButton
              key={group.id}
              selected={selectedGroupId === group.id}
              onClick={() => setSelectedGroupId(group.id)}
              sx={{ py: 1.5 }}
            >
              <ListItemText
                primary={group.outlineSection?.title || group.title || `Section ${group.id}`}
                secondary={group.generatedText ? t('drafting.statuses.drafted') : t('drafting.statuses.pending')}
                primaryTypographyProps={{ variant: 'body2', fontWeight: selectedGroupId === group.id ? 600 : 400 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              <Chip
                size="small"
                variant="outlined"
                color={group.generatedText ? 'success' : 'default'}
                label={group.generatedText ? 'OK' : '-'}
                sx={{ ml: 1 }}
              />
            </ListItemButton>
          ))}
        </List>
      </Paper>

      {/* Center panel: Draft editor */}
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {selectedGroup ? (
          <Card>
            <CardContent>
              {/* Section title and description */}
              <Typography variant="h6" gutterBottom>
                {selectedGroup.outlineSection?.title || selectedGroup.title || `Section ${selectedGroup.id}`}
              </Typography>
              {selectedGroup.outlineSection?.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedGroup.outlineSection.description}
                </Typography>
              )}

              {/* Model selector and generate button */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>{t('project.drafting.model')}</InputLabel>
                  <Select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    label={t('project.drafting.model')}
                  >
                    {modelList.map((model: any) => (
                      <MenuItem key={typeof model === 'string' ? model : model.id} value={typeof model === 'string' ? model : model.id}>
                        {typeof model === 'string' ? model : model.name || model.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  startIcon={isStreaming ? <CircularProgress size={16} /> : <Wand2 size={16} strokeWidth={1} />}
                  onClick={handleGenerate}
                  disabled={isStreaming}
                >
                  {t('project.drafting.generate')}
                </Button>
                <Button variant="outlined" onClick={handleSaveText} disabled={isStreaming}>
                  {t('common.save')}
                </Button>
              </Box>

              {/* System prompt accordion */}
              <Accordion sx={{ mb: 2 }} disableGutters>
                <AccordionSummary expandIcon={<ChevronDown size={16} strokeWidth={1} />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Settings2 size={16} strokeWidth={1} />
                    <Typography variant="subtitle2">{t('project.drafting.prompt')}</Typography>
                    {promptDirty && <Chip label={t('drafting.unsaved')} size="small" color="warning" />}
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    multiline
                    minRows={4}
                    maxRows={12}
                    fullWidth
                    size="small"
                    value={systemPrompt}
                    onChange={(e) => { setSystemPrompt(e.target.value); setPromptDirty(true) }}
                    placeholder={t('settings.promptPlaceholder')}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleSavePrompt}
                      disabled={!promptDirty || updateDraftGroup.isPending}
                    >
                      {t('common.save')}
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* Generated text editor */}
              <TextField
                multiline
                minRows={10}
                maxRows={24}
                fullWidth
                value={isStreaming ? streamedText : editText}
                onChange={(e) => setEditText(e.target.value)}
                disabled={isStreaming}
                placeholder={t('drafting.responsePlaceholder')}
              />

              {/* Streaming indicator */}
              {isStreaming && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">{t('drafting.generating')}</Typography>
                </Box>
              )}

              {/* Matched feedback */}
              {matchedFeedback.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">{t('drafting.feedback')}</Typography>
                  {matchedFeedback.map((f: any) => (
                    <Paper key={f.id} variant="outlined" sx={{ p: 1, mt: 1 }}>
                      <Chip label={f.feedbackType} size="small" sx={{ mr: 1 }} />
                      <Chip label={f.severity} size="small" color={f.severity === 'critical' ? 'error' : 'default'} />
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {f.content}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}

              {/* Items list for this section */}
              {groupItems.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('project.drafting.groupItems')} ({groupItems.length})
                  </Typography>
                  <List dense>
                    {groupItems.map((item: any) => (
                      <Paper key={item.id} variant="outlined" sx={{ p: 1, mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={item.itemType === 'question' ? t('project.extract.questions') : t('project.extract.conditions')}
                            size="small"
                            variant="outlined"
                            color={item.itemType === 'question' ? 'primary' : 'secondary'}
                          />
                          <Typography variant="body2">{item.text}</Typography>
                        </Box>
                      </Paper>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography color="text.secondary">{t('project.drafting.sections')}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
