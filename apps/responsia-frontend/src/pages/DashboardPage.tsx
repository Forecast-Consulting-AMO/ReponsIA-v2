import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Chip,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material'
import { Plus, Search, Trash2, FolderOpen } from 'lucide-react'
import { useProjects, useCreateProject, useDeleteProject } from '../hooks/useApi'

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success'> = {
  draft: 'default',
  in_progress: 'warning',
  completed: 'success',
}

export const DashboardPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const filtered = (projects || []).filter(
    (p: any) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()),
  )

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const project = await createProject.mutateAsync({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      })
      setDialogOpen(false)
      setNewName('')
      setNewDesc('')
      enqueueSnackbar(t('dashboard.projectCreated', { name: newName.trim() }), { variant: 'success' })
      navigate(`/projects/${project.id}`)
    } catch (err: any) {
      console.error('Failed to create project:', err)
      enqueueSnackbar(err?.response?.data?.message || err?.message || t('errors.http.generic'), { variant: 'error' })
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          {t('dashboard.title')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Plus size={18} strokeWidth={1} />}
          onClick={() => setDialogOpen(true)}
        >
          {t('dashboard.newProject')}
        </Button>
      </Box>

      <TextField
        placeholder={t('dashboard.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        fullWidth
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={18} strokeWidth={1} />
            </InputAdornment>
          ),
        }}
      />

      {filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <FolderOpen size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            {t('dashboard.noProjects')}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((project: any) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
              <Card
                sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6" noWrap>
                      {project.name}
                    </Typography>
                    <Chip
                      label={t(`project.status.${project.status}`)}
                      color={STATUS_COLORS[project.status] || 'default'}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {project.description || t('dashboard.noDescription')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(t('dashboard.confirmDelete'))) {
                        deleteProject.mutate(project.id)
                      }
                    }}
                  >
                    <Trash2 size={16} strokeWidth={1} />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('dashboard.createProject')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('project.name')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            label={t('project.description')}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newName.trim() || createProject.isPending}
          >
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
