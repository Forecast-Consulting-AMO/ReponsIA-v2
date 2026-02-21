import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Select,
  MenuItem,
  TextField,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Chip,
} from '@mui/material'
import { ChevronDown, Save } from 'lucide-react'
import { useModels, usePreferences, useUpdatePreferences } from '../hooks/useApi'

const OPERATIONS = ['analysis', 'drafting', 'feedback', 'compliance', 'chat'] as const

export const SettingsPage = () => {
  const { t } = useTranslation()
  const { data: modelsData, isLoading: modelsLoading } = useModels()
  const { data: prefsData, isLoading: prefsLoading } = usePreferences()
  const updatePrefs = useUpdatePreferences()

  const [models, setModels] = useState<Record<string, string>>({})
  const [prompts, setPrompts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (prefsData) {
      setModels(prefsData.models || {})
      setPrompts(prefsData.prompts || {})
    }
  }, [prefsData])

  const handleSave = () => {
    updatePrefs.mutate({ models, prompts })
  }

  if (modelsLoading || prefsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  const availableModels = modelsData?.models || []
  const defaultPrompts: Record<string, string> = prefsData?.defaultPrompts || {}

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {t('settings.title')}
      </Typography>

      {/* Model selection per operation */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('settings.models')}
          </Typography>
          {OPERATIONS.map((op) => (
            <Box key={op} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ minWidth: 140 }}>{t(`settings.operations.${op}`)}</Typography>
              <Select
                value={models[op] || modelsData?.defaults?.[op] || ''}
                onChange={(e) => setModels((prev) => ({ ...prev, [op]: e.target.value }))}
                size="small"
                sx={{ minWidth: 200 }}
              >
                {availableModels.map((m: any) => (
                  <MenuItem key={m.id} value={m.id} disabled={!m.available}>
                    {m.label} {!m.available ? '(no key)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* Prompts per operation */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('settings.prompts')}
          </Typography>
          {OPERATIONS.map((op) => (
            <Accordion key={op} defaultExpanded>
              <AccordionSummary expandIcon={<ChevronDown size={18} strokeWidth={1} />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>{t(`settings.operations.${op}`)}</Typography>
                  {prompts[op] && (
                    <Chip label={t('settings.customized')} size="small" color="primary" variant="outlined" />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {/* Default system prompt — always visible */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {t('settings.defaultPrompt')}
                </Typography>
                <Box
                  sx={{
                    p: 1.5,
                    mb: 2,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {defaultPrompts[op] || '—'}
                </Box>

                {/* Custom override */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {t('settings.customPrompt')}
                </Typography>
                <TextField
                  multiline
                  minRows={3}
                  maxRows={10}
                  fullWidth
                  value={prompts[op] || ''}
                  onChange={(e) => setPrompts((prev) => ({ ...prev, [op]: e.target.value }))}
                  placeholder={t('settings.promptPlaceholder')}
                />
              </AccordionDetails>
            </Accordion>
          ))}
        </CardContent>
      </Card>

      <Button
        variant="contained"
        startIcon={<Save size={18} strokeWidth={1} />}
        onClick={handleSave}
        disabled={updatePrefs.isPending}
      >
        {t('common.save')}
      </Button>
    </Box>
  )
}
