import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Tabs,
  Tab,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import { ArrowLeft, Upload, Pencil, ShieldCheck, Settings, Users } from 'lucide-react'
import { useProject } from '../hooks/useApi'
import { SetupPhase } from './project/SetupPhase'
import { DraftingPhase } from './project/DraftingPhase'
import { ReviewPhase } from './project/ReviewPhase'
import { ProjectSettingsTab } from './project/ProjectSettingsTab'
import { MembersTab } from './project/MembersTab'

export const ProjectPage = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = parseInt(id!, 10)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: project, isLoading } = useProject(projectId)
  const [phase, setPhase] = useState(0)

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!project) {
    return (
      <Box sx={{ textAlign: 'center', mt: 10 }}>
        <Typography color="text.secondary">{t('project.notFound')}</Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Tooltip title={t('common.back')}>
          <IconButton onClick={() => navigate('/')}>
            <ArrowLeft size={20} strokeWidth={1} />
          </IconButton>
        </Tooltip>
        <Typography variant="h5" fontWeight={700}>
          {project.name}
        </Typography>
      </Box>

      <Tabs value={phase} onChange={(_, v) => setPhase(v)} sx={{ mb: 3 }}>
        <Tab icon={<Upload size={18} strokeWidth={1} />} iconPosition="start" label={t('project.setup.title')} />
        <Tab icon={<Pencil size={18} strokeWidth={1} />} iconPosition="start" label={t('project.drafting.title')} />
        <Tab icon={<ShieldCheck size={18} strokeWidth={1} />} iconPosition="start" label={t('project.review.title')} />
        <Tab icon={<Users size={18} strokeWidth={1} />} iconPosition="start" label={t('members.title')} />
        <Tab icon={<Settings size={18} strokeWidth={1} />} iconPosition="start" label={t('nav.settings')} />
      </Tabs>

      {phase === 0 && <SetupPhase projectId={projectId} />}
      {phase === 1 && <DraftingPhase projectId={projectId} />}
      {phase === 2 && <ReviewPhase projectId={projectId} />}
      {phase === 3 && <MembersTab projectId={projectId} />}
      {phase === 4 && <ProjectSettingsTab projectId={projectId} />}
    </Box>
  )
}
