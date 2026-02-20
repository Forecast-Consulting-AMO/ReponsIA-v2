import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
} from '@mui/material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { MessageSquare, Wand2, Send } from 'lucide-react'
import { useRequirements, useUpdateRequirement, useFeedback, useChatHistory } from '../../hooks/useApi'
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
  const { data: requirements, refetch: refetchReqs } = useRequirements(projectId)
  const { data: feedback } = useFeedback(projectId)
  const { data: chatHistory, refetch: refetchChat } = useChatHistory(projectId)
  const updateReq = useUpdateRequirement()
  const { startStream, isStreaming, streamedText } = useSSE()

  const [selected, setSelected] = useState<any>(null)
  const [editText, setEditText] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const chatSSE = useSSE()

  // Select a requirement
  const handleSelect = (req: any) => {
    setSelected(req)
    setEditText(req.responseText || '')
  }

  // Draft a single requirement via SSE
  const handleDraft = () => {
    if (!selected) return
    startStream(`/api/v1/requirements/${selected.id}/draft`, {}, {
      onDone: () => refetchReqs(),
    })
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

  // Send chat message
  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    const msg = chatInput
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }])

    chatSSE.startStream(`/api/v1/projects/${projectId}/chat`, { message: msg }, {
      onDone: () => {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: chatSSE.streamedText }])
        refetchChat()
      },
    })
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
            onClick={() => startStream(`/api/v1/projects/${projectId}/draft-all`, {}, { onDone: () => refetchReqs() })}
            disabled={isStreaming}
          >
            {t('drafting.draftAll')}
          </Button>
        </Box>
        <DataGrid
          rows={requirements || []}
          columns={columns}
          onRowClick={(params) => handleSelect(params.row)}
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
                onChange={(e) => setEditText(e.target.value)}
                disabled={isStreaming}
                placeholder={t('drafting.responsePlaceholder')}
              />

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
          {chatSSE.isStreaming && (
            <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'grey.100' }}>
              <Typography variant="body2">{chatSSE.streamedText}</Typography>
            </Box>
          )}
        </Box>

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
