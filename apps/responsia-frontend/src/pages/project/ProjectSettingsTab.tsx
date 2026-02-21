import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box, Typography, Card, CardContent, Select, MenuItem,
  TextField, Button, Accordion, AccordionSummary, AccordionDetails,
  FormControl, InputLabel,
} from '@mui/material'
import { ChevronDown, Save } from 'lucide-react'
import { useSnackbar } from 'notistack'
import { useProjectSettings, useUpdateProjectSettings, useModels, usePreferences } from '../../hooks/useApi'

const OPERATIONS = ['analysis', 'drafting', 'feedback', 'compliance', 'chat'] as const

interface Props {
  projectId: number
}

export const ProjectSettingsTab = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const { data: modelsData } = useModels()
  const { data: prefsData } = usePreferences()
  const { data: projectSettings } = useProjectSettings(projectId)
  const updateSettings = useUpdateProjectSettings(projectId)

  const [models, setModels] = useState<Record<string, string>>({})
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [contentLanguage, setContentLanguage] = useState('fr')

  useEffect(() => {
    if (projectSettings) {
      setModels(projectSettings.models || {})
      setPrompts(projectSettings.prompts || {})
      setContentLanguage(projectSettings.contentLanguage || 'fr')
    }
  }, [projectSettings])

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({ models, prompts, contentLanguage })
      enqueueSnackbar(t('common.save') + ' ✓', { variant: 'success' })
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const availableModels = modelsData?.models || []
  const defaultPrompts: Record<string, string> = prefsData?.defaultPrompts || {}

  // Effective model = project override || user default || system default
  const getEffectiveModel = (op: string) =>
    models[op] || prefsData?.models?.[op] || modelsData?.defaults?.[op] || ''

  return (
    <Box sx={{ maxWidth: 700 }}>
      {/* Content language */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('settings.contentLanguage')}</Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('settings.contentLanguage')}</InputLabel>
            <Select value={contentLanguage} label={t('settings.contentLanguage')} onChange={(e) => setContentLanguage(e.target.value)}>
              <MenuItem value="fr">Fran&#231;ais</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="nl">Nederlands</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Model overrides per operation */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('settings.models')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('settings.projectModelHint')}</Typography>
          {OPERATIONS.map((op) => (
            <Box key={op} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ minWidth: 140 }}>{t(`settings.operations.${op}`)}</Typography>
              <Select
                value={models[op] || ''}
                onChange={(e) => setModels((prev) => ({ ...prev, [op]: e.target.value }))}
                size="small"
                sx={{ minWidth: 200 }}
                displayEmpty
              >
                <MenuItem value=""><em>{t('settings.useDefault')} ({getEffectiveModel(op)})</em></MenuItem>
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

      {/* Prompt overrides per operation */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('settings.prompts')}</Typography>
          {OPERATIONS.map((op) => (
            <Accordion key={op}>
              <AccordionSummary expandIcon={<ChevronDown size={18} strokeWidth={1} />}>
                <Typography>{t(`settings.operations.${op}`)}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  {t('settings.defaultPrompt')}
                </Typography>
                <Box sx={{ p: 1, mb: 2, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider', whiteSpace: 'pre-wrap', fontSize: '0.8rem', fontFamily: 'monospace', maxHeight: 150, overflow: 'auto' }}>
                  {defaultPrompts[op] || '—'}
                </Box>
                <TextField
                  multiline
                  minRows={3}
                  maxRows={8}
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

      <Button variant="contained" startIcon={<Save size={18} strokeWidth={1} />} onClick={handleSave} disabled={updateSettings.isPending}>
        {t('common.save')}
      </Button>
    </Box>
  )
}
