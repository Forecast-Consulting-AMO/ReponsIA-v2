import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Select,
  SelectChangeEvent,
  Avatar,
  Tooltip,
} from '@mui/material'
import {
  LogOut,
  Settings,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'nl', label: 'NL' },
]

export const Layout = () => {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleLanguageChange = (e: SelectChangeEvent) => {
    i18n.changeLanguage(e.target.value)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="fixed" color="default" elevation={1}>
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ cursor: 'pointer', fontWeight: 700 }}
            onClick={() => navigate('/')}
          >
            ReponsIA
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Select
            value={i18n.language?.substring(0, 2) || 'fr'}
            onChange={handleLanguageChange}
            size="small"
            variant="standard"
            sx={{ mr: 2, minWidth: 50 }}
          >
            {LANGUAGES.map((l) => (
              <MenuItem key={l.code} value={l.code}>
                {l.label}
              </MenuItem>
            ))}
          </Select>

          <Tooltip title={t('nav.settings')}>
            <IconButton onClick={() => navigate('/settings')} size="small" sx={{ mr: 1 }}>
              <Settings size={20} strokeWidth={1} />
            </IconButton>
          </Tooltip>

          <Tooltip title={user?.email || ''}>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
              <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                {(user?.name || user?.email || 'U')[0].toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={!!anchorEl}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem disabled>
              <Typography variant="body2">{user?.email}</Typography>
            </MenuItem>
            <MenuItem onClick={() => { navigate('/settings'); setAnchorEl(null) }}>
              <Settings size={16} strokeWidth={1} style={{ marginRight: 8 }} />
              {t('nav.settings')}
            </MenuItem>
            <MenuItem onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
              <LogOut size={16} strokeWidth={1} style={{ marginRight: 8 }} />
              {t('nav.logout')}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, mt: 8, p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  )
}
