import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box, Typography, Card, CardContent, TextField, Button, Select, MenuItem,
  List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import { UserPlus, Trash2, Crown, Edit3, Eye } from 'lucide-react'
import { useSnackbar } from 'notistack'
import { useMembers, useInviteMember, useRemoveMember } from '../../hooks/useApi'

const ROLE_ICONS: Record<string, any> = {
  owner: Crown,
  editor: Edit3,
  viewer: Eye,
}

const ROLE_COLORS: Record<string, 'primary' | 'warning' | 'default'> = {
  owner: 'primary',
  editor: 'warning',
  viewer: 'default',
}

interface Props {
  projectId: number
}

export const MembersTab = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const { data: members } = useMembers(projectId)
  const inviteMember = useInviteMember(projectId)
  const removeMember = useRemoveMember(projectId)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>('editor')

  const handleInvite = async () => {
    if (!email.trim()) return
    try {
      await inviteMember.mutateAsync({ email: email.trim(), role })
      enqueueSnackbar(t('members.invited'), { variant: 'success' })
      setDialogOpen(false)
      setEmail('')
    } catch {
      enqueueSnackbar(t('errors.http.generic'), { variant: 'error' })
    }
  }

  const handleRemove = async (memberId: number) => {
    if (!confirm(t('members.confirmRemove'))) return
    try {
      await removeMember.mutateAsync(memberId)
      enqueueSnackbar(t('members.removed'), { variant: 'success' })
    } catch (err: any) {
      enqueueSnackbar(err?.response?.data?.message || t('errors.http.generic'), { variant: 'error' })
    }
  }

  return (
    <Box sx={{ maxWidth: 600 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{t('members.title')}</Typography>
        <Button variant="outlined" startIcon={<UserPlus size={16} strokeWidth={1} />} onClick={() => setDialogOpen(true)}>
          {t('members.invite')}
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <List>
            {(members || []).map((m: any) => {
              const RoleIcon = ROLE_ICONS[m.role] || Eye
              return (
                <ListItem key={m.id} divider>
                  <ListItemText
                    primary={m.email || m.auth0Id}
                    secondary={m.acceptedAt ? t('members.accepted') : t('members.pending')}
                  />
                  <Chip
                    icon={<RoleIcon size={14} strokeWidth={1} />}
                    label={t(`members.roles.${m.role}`)}
                    color={ROLE_COLORS[m.role] || 'default'}
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                  />
                  {m.role !== 'owner' && (
                    <ListItemSecondaryAction>
                      <IconButton size="small" onClick={() => handleRemove(m.id)}>
                        <Trash2 size={16} strokeWidth={1} />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              )
            })}
          </List>
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('members.inviteTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('members.email')}
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <Select value={role} onChange={(e) => setRole(e.target.value)} size="small" fullWidth>
            <MenuItem value="editor">{t('members.roles.editor')}</MenuItem>
            <MenuItem value="viewer">{t('members.roles.viewer')}</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleInvite} disabled={!email.trim() || inviteMember.isPending}>
            {t('members.invite')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
