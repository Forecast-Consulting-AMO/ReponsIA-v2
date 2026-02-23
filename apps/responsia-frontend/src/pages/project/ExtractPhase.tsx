import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import {
  Box,
  Button,
  Typography,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardContent,
  CircularProgress,
  Select,
  MenuItem,
  Checkbox,
} from '@mui/material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { Sparkles, RefreshCw } from 'lucide-react'
import {
  useExtractedItems,
  useExtractedItemsByTheme,
  useExtractItems,
  useUpdateItem,
  useOutline,
} from '../../hooks/useApi'

interface Props {
  projectId: number
}

export const ExtractPhase = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const { data: items, refetch: refetchItems } = useExtractedItems(projectId)
  const { data: itemsByTheme, refetch: refetchByTheme } = useExtractedItemsByTheme(projectId)
  const extractItems = useExtractItems(projectId)
  const updateItem = useUpdateItem()
  const { data: outline } = useOutline(projectId)

  const [viewMode, setViewMode] = useState<'section' | 'theme'>('section')

  const questions = (items || []).filter((item: any) => item.itemType === 'question')
  const conditions = (items || []).filter((item: any) => item.itemType === 'condition')

  const handleExtract = async () => {
    try {
      await extractItems.mutateAsync()
      refetchItems()
      refetchByTheme()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const handleReclassify = async (item: any) => {
    const newType = item.itemType === 'question' ? 'condition' : 'question'
    try {
      await updateItem.mutateAsync({ id: item.id, itemType: newType })
      refetchItems()
      refetchByTheme()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const handleUpdateOutlineSection = async (itemId: number, outlineSectionId: number | null) => {
    try {
      await updateItem.mutateAsync({ id: itemId, outlineSectionId })
      refetchItems()
      refetchByTheme()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const handleToggleAddressed = async (item: any) => {
    try {
      await updateItem.mutateAsync({ id: item.id, addressed: !item.addressed })
      refetchItems()
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const questionColumns: GridColDef[] = [
    {
      field: 'sectionRef',
      headerName: t('drafting.section'),
      width: 120,
    },
    {
      field: 'text',
      headerName: t('project.extract.questions'),
      flex: 1,
      minWidth: 300,
    },
    {
      field: 'status',
      headerName: t('drafting.status'),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value || 'pending'}
          size="small"
          variant="outlined"
          color={params.value === 'answered' ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'outlineSectionId',
      headerName: t('project.structure.title'),
      width: 200,
      renderCell: (params) => (
        <Select
          value={params.value || ''}
          onChange={(e) => handleUpdateOutlineSection(params.row.id, e.target.value ? Number(e.target.value) : null)}
          size="small"
          fullWidth
          displayEmpty
        >
          <MenuItem value="">-</MenuItem>
          {(outline || []).map((s: any) => (
            <MenuItem key={s.id} value={s.id}>
              {s.numbering ? `${s.numbering} ` : ''}{s.title}
            </MenuItem>
          ))}
        </Select>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Button
          size="small"
          variant="text"
          startIcon={<RefreshCw size={14} strokeWidth={1} />}
          onClick={() => handleReclassify(params.row)}
        >
          {t('project.extract.reclassify')}
        </Button>
      ),
    },
  ]

  const conditionColumns: GridColDef[] = [
    {
      field: 'addressed',
      headerName: '',
      width: 60,
      sortable: false,
      renderCell: (params) => (
        <Checkbox
          checked={!!params.value}
          onChange={() => handleToggleAddressed(params.row)}
          size="small"
        />
      ),
    },
    {
      field: 'sectionRef',
      headerName: t('drafting.section'),
      width: 120,
    },
    {
      field: 'text',
      headerName: t('project.extract.conditions'),
      flex: 1,
      minWidth: 300,
    },
    {
      field: 'actions',
      headerName: '',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Button
          size="small"
          variant="text"
          startIcon={<RefreshCw size={14} strokeWidth={1} />}
          onClick={() => handleReclassify(params.row)}
        >
          {t('project.extract.reclassify')}
        </Button>
      ),
    },
  ]

  // By-theme view
  const renderByTheme = () => {
    if (!itemsByTheme || typeof itemsByTheme !== 'object') {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
          {t('project.extract.noItems')}
        </Typography>
      )
    }

    const themes = Object.keys(itemsByTheme)
    if (themes.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
          {t('project.extract.noItems')}
        </Typography>
      )
    }

    return themes.map((theme) => (
      <Card key={theme} variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            {theme}
          </Typography>
          <DataGrid
            rows={itemsByTheme[theme] || []}
            columns={questionColumns}
            autoHeight
            density="compact"
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{ bgcolor: 'background.paper' }}
          />
        </CardContent>
      </Card>
    ))
  }

  return (
    <Box>
      {/* Header with toggle and extract button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">{t('project.extract.title')}</Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="section">{t('project.extract.bySection')}</ToggleButton>
            <ToggleButton value="theme">{t('project.extract.byTheme')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Button
          variant="contained"
          startIcon={extractItems.isPending ? <CircularProgress size={16} /> : <Sparkles size={16} strokeWidth={1} />}
          onClick={handleExtract}
          disabled={extractItems.isPending}
        >
          {extractItems.isPending ? t('project.extract.extracting') : t('project.extract.extractBtn')}
        </Button>
      </Box>

      {/* No items message */}
      {(!items || items.length === 0) && !extractItems.isPending && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
          {t('project.extract.noItems')}
        </Typography>
      )}

      {/* By-section view */}
      {viewMode === 'section' && items && items.length > 0 && (
        <Box>
          {/* Questions DataGrid */}
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            {t('project.extract.questions')} ({questions.length})
          </Typography>
          <DataGrid
            rows={questions}
            columns={questionColumns}
            autoHeight
            density="compact"
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            sx={{ bgcolor: 'background.paper', mb: 4 }}
          />

          {/* Conditions DataGrid */}
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            {t('project.extract.conditions')} ({conditions.length})
          </Typography>
          <DataGrid
            rows={conditions}
            columns={conditionColumns}
            autoHeight
            density="compact"
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            sx={{ bgcolor: 'background.paper' }}
          />
        </Box>
      )}

      {/* By-theme view */}
      {viewMode === 'theme' && items && items.length > 0 && renderByTheme()}
    </Box>
  )
}
