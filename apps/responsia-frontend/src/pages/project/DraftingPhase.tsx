import { useState, useCallback, useEffect, useRef } from 'react'
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
  Drawer,
  IconButton,
  Divider,
  Paper,
  CircularProgress,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { MessageSquare, Wand2, Send, Search, ChevronDown, Settings2 } from 'lucide-react'
import { useRequirements, useUpdateRequirement, useFeedback, useChatHistory, useProjectSettings, useUpdateProjectSettings } from '../../hooks/useApi'
import { useSSE } from '../../hooks/useSSE'

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success'> = {
  pending: 'default',
  drafted: 'info',
  reviewed: 'warning',
  final: 'success',
}

interface Props {
  projectId: number
}

export const DraftingPhase = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const { data: requirements, refetch: refetchReqs } = useRequirements(projectId)
  const { data: feedback } = useFeedback(projectId)
  const { data: chatHistory, refetch: refetchChat } = useChatHistory(projectId)
  const { data: projectSettings } = useProjectSettings(projectId)
  const updateProjectSettings = useUpdateProjectSettings(projectId)
  const updateReq = useUpdateRequirement()
  const { startStream, isStreaming, streamedText } = useSSE()

  // Inline prompt editing
  const [draftPrompt, setDraftPrompt] = useState('')
  const [promptDirty, setPromptDirty] = useState(false)

  useEffect(() => {
    if (projectSettings?.prompts?.drafting !== undefined) {
      setDraftPrompt(projectSettings.prompts.drafting)
    }
  }, [projectSettings?.prompts?.drafting])

  const [selected, setSelected] = useState<any>(null)
  const [editText, setEditText] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const chatSSE = useSSE()

  // --- Search / Filter ---
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  const filteredRequirements = (requirements || []).filter((r: any) => {
    const matchesSearch = !searchTerm ||
      r.sectionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.sectionTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requirementText?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || r.responseStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  // --- Bulk selection ---
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // --- Chat edit diff ---
  const [editDiff, setEditDiff] = useState<{ old: string; new: string; requirementId: number } | null>(null)

  // --- Autosave with debounce ---
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedSave = useCallback((id: number, text: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      updateReq.mutate({ id, responseText: text })
    }, 1500)
  }, [updateReq])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setEditText(newText)
    if (selected) debouncedSave(selected.id, newText)
  }

  // Select a requirement
  const handleSelect = (req: any) => {
    setSelected(req)
    setEditText(req.responseText || '')
  }

  // Draft a single requirement via SSE
  const handleDraft = () => {
    if (!selected) return
    startStream(`/api/v1/requirements/${selected.id}/draft`, {}, {
      onDone: () => {
        refetchReqs()
      },
      onError: (error) => {
        enqueueSnackbar(error || t('errors.draftFailed'), { variant: 'error' })
      },
    })
  }

  // Sync streamed text back to editor when streaming ends
  useEffect(() => {
    if (!isStreaming && streamedText && selected) {
      setEditText(streamedText)
    }
  }, [isStreaming, streamedText, selected])

  // Save inline prompt
  const handleSavePrompt = async () => {
    try {
      await updateProjectSettings.mutateAsync({
        prompts: { ...projectSettings?.prompts, drafting: draftPrompt },
      })
      setPromptDirty(false)
      enqueueSnackbar(t('drafting.promptSaved'), { variant: 'success' })
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  // Save edited response
  const handleSave = async () => {
    if (!selected) return
    await updateReq.mutateAsync({
      id: selected.id,
      responseText: editText,
      responseStatus: 'reviewed',
    })
    refetchReqs()
  }

  // Detect edit intent in chat message
  const isEditIntent = (msg: string) => {
    const editKeywords = ['section', 'modifier', 'réécrire', 'rewrite', 'edit']
    const lower = msg.toLowerCase()
    return editKeywords.some((kw) => lower.includes(kw))
  }

  // Send chat message
  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    const msg = chatInput
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }])

    const onChatError = (error: string) => {
      enqueueSnackbar(error || t('errors.chatFailed'), { variant: 'error' })
    }

    // If this looks like an edit request and we have a selected requirement, use the edit endpoint
    if (selected && isEditIntent(msg)) {
      chatSSE.startStream(`/api/v1/projects/${projectId}/chat/edit`, {
        requirementId: selected.id,
        instruction: msg,
      }, {
        onDone: (data: any) => {
          if (data?.diff) {
            setEditDiff({
              old: data.diff.old || selected.responseText || '',
              new: data.diff.new || '',
              requirementId: selected.id,
            })
          }
          setChatMessages((prev) => [...prev, { role: 'assistant', content: chatSSE.streamedText || data?.text || '' }])
          refetchChat()
        },
        onError: onChatError,
      })
    } else {
      chatSSE.startStream(`/api/v1/projects/${projectId}/chat`, { message: msg }, {
        onDone: () => {
          setChatMessages((prev) => [...prev, { role: 'assistant', content: chatSSE.streamedText }])
          refetchChat()
        },
        onError: onChatError,
      })
    }
  }

  const columns: GridColDef[] = [
    { field: 'sectionNumber', headerName: t('drafting.section'), width: 100 },
    { field: 'sectionTitle', headerName: t('drafting.title'), flex: 1 },
    {
      field: 'requirementType',
      headerName: t('drafting.type'),
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: 'responseStatus',
      headerName: t('drafting.status'),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={t(`drafting.statuses.${params.value}`)}
          color={STATUS_COLORS[params.value] || 'default'}
          size="small"
        />
      ),
    },
  ]

  // Matched feedback for selected requirement
  const matchedFeedback = selected
    ? (feedback || []).filter((f: any) => f.requirementId === selected.id)
    : []

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 200px)' }}>
      {/* Left: Requirements table */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">{t('drafting.requirements')}</Typography>
          <Button
            size="small"
            startIcon={<Wand2 size={16} strokeWidth={1} />}
            variant="outlined"
            onClick={() => startStream(`/api/v1/projects/${projectId}/draft-all`, {}, {
              onDone: () => refetchReqs(),
              onError: (error) => enqueueSnackbar(error || t('errors.draftFailed'), { variant: 'error' }),
            })}
            disabled={isStreaming}
          >
            {t('drafting.draftAll')}
          </Button>
        </Box>

        {/* Search and filter chips */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder={t('common.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 200 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search size={16} strokeWidth={1} /></InputAdornment>,
            }}
          />
          {(['pending', 'drafted', 'reviewed', 'final'] as const).map(status => (
            <Chip
              key={status}
              label={t(`drafting.statuses.${status}`)}
              variant={statusFilter === status ? 'filled' : 'outlined'}
              color={STATUS_COLORS[status] || 'default'}
              onClick={() => setStatusFilter(statusFilter === status ? null : status)}
              size="small"
            />
          ))}
        </Box>

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1, p: 1, bgcolor: 'action.selected', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1 }}>
              {selectedIds.length} {t('drafting.selected')}
            </Typography>
            {(['drafted', 'reviewed', 'final'] as const).map(status => (
              <Button key={status} size="small" variant="outlined" onClick={async () => {
                for (const id of selectedIds) {
                  await updateReq.mutateAsync({ id, responseStatus: status })
                }
                setSelectedIds([])
                refetchReqs()
              }}>
                &rarr; {t(`drafting.statuses.${status}`)}
              </Button>
            ))}
          </Box>
        )}

        <DataGrid
          rows={filteredRequirements}
          columns={columns}
          onRowClick={(params) => handleSelect(params.row)}
          checkboxSelection
          onRowSelectionModelChange={(model) => setSelectedIds(Array.from(model.ids) as number[])}
          autoHeight
          density="compact"
          disableRowSelectionOnClick
          sx={{ bgcolor: 'background.paper' }}
        />
      </Box>

      {/* Center: Selected requirement editor */}
      {selected && (
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600}>
                {selected.sectionNumber} — {selected.sectionTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                {selected.requirementText}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Wand2 size={16} strokeWidth={1} />}
                  onClick={handleDraft}
                  disabled={isStreaming}
                >
                  {t('drafting.draft')}
                </Button>
                <Button size="small" variant="outlined" onClick={handleSave}>
                  {t('common.save')}
                </Button>
                <IconButton size="small" onClick={() => setChatOpen(true)}>
                  <MessageSquare size={18} strokeWidth={1} />
                </IconButton>
              </Box>

              <TextField
                multiline
                minRows={8}
                maxRows={20}
                fullWidth
                value={isStreaming ? streamedText : editText}
                onChange={handleTextChange}
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

              {/* Autosaved indicator */}
              {updateReq.isSuccess && (
                <Typography variant="caption" color="success.main" sx={{ mt: 0.5 }}>
                  {t('drafting.autosaved')}
                </Typography>
              )}

              {/* Inline prompt editor */}
              <Accordion sx={{ mt: 2 }} disableGutters>
                <AccordionSummary expandIcon={<ChevronDown size={16} strokeWidth={1} />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Settings2 size={16} strokeWidth={1} />
                    <Typography variant="subtitle2">{t('drafting.systemPrompt')}</Typography>
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
                    value={draftPrompt}
                    onChange={(e) => { setDraftPrompt(e.target.value); setPromptDirty(true) }}
                    placeholder={t('settings.promptPlaceholder')}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleSavePrompt}
                      disabled={!promptDirty || updateProjectSettings.isPending}
                    >
                      {t('common.save')}
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>

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
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Right: Chat drawer */}
      <Drawer
        anchor="right"
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        variant="temporary"
        sx={{ '& .MuiDrawer-paper': { width: 380, p: 2 } }}
      >
        <Typography variant="h6" gutterBottom>
          {t('chat.title')}
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
          {[...(chatHistory || []), ...chatMessages].map((msg: any, i) => (
            <Box
              key={i}
              sx={{
                mb: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: msg.role === 'user' ? 'primary.light' : 'grey.100',
                color: msg.role === 'user' ? 'white' : 'text.primary',
                ml: msg.role === 'user' ? 4 : 0,
                mr: msg.role === 'assistant' ? 4 : 0,
              }}
            >
              <Typography variant="body2">{msg.content}</Typography>
            </Box>
          ))}
          {/* Typing indicator */}
          {chatSSE.isStreaming && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: 'grey.100' }}>
              <CircularProgress size={12} />
              <Typography variant="body2">{chatSSE.streamedText || t('chat.thinking')}</Typography>
            </Box>
          )}
        </Box>

        {/* Edit diff view */}
        {editDiff && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>{t('chat.editSuggestion')}</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Paper variant="outlined" sx={{ flex: 1, p: 1, bgcolor: 'error.light', opacity: 0.2 }}>
                <Typography variant="caption" fontWeight={600}>{t('chat.current')}</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{editDiff.old}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ flex: 1, p: 1, bgcolor: 'success.light', opacity: 0.2 }}>
                <Typography variant="caption" fontWeight={600}>{t('chat.suggested')}</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{editDiff.new}</Typography>
              </Paper>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button size="small" variant="contained" color="success" onClick={() => {
                updateReq.mutateAsync({ id: editDiff.requirementId, responseText: editDiff.new, responseStatus: 'reviewed' })
                setEditText(editDiff.new)
                setEditDiff(null)
                refetchReqs()
              }}>
                {t('chat.accept')}
              </Button>
              <Button size="small" variant="outlined" onClick={() => setEditDiff(null)}>
                {t('chat.reject')}
              </Button>
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={t('chat.placeholder')}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
          />
          <IconButton color="primary" onClick={handleSendChat} disabled={chatSSE.isStreaming}>
            <Send size={18} strokeWidth={1} />
          </IconButton>
        </Box>
      </Drawer>
    </Box>
  )
}
