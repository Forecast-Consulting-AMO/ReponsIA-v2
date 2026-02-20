import { useAuth0 } from '@auth0/auth0-react'
import { useEffect } from 'react'
import { setGlobalToken, clearAllTokens } from '../api/mutator'

/**
 * Hook that syncs Auth0 token into the global Axios instance.
 * Also provides a dev-mode bypass when VITE_AUTH0_DOMAIN is not set.
 */
export const useAuth = () => {
  const auth0 = useAuth0()
  const isDev = !import.meta.env.VITE_AUTH0_DOMAIN

  useEffect(() => {
    if (isDev) {
      setGlobalToken('dev-token')
      return
    }
    if (auth0.isAuthenticated) {
      auth0.getAccessTokenSilently().then(setGlobalToken).catch(console.error)
    } else {
      clearAllTokens()
    }
  }, [auth0.isAuthenticated, isDev])

  return {
    isAuthenticated: isDev || auth0.isAuthenticated,
    isLoading: isDev ? false : auth0.isLoading,
    user: isDev
      ? { sub: 'dev|local-user', email: 'dev@responsia.local', name: 'Dev User' }
      : auth0.user,
    loginWithRedirect: auth0.loginWithRedirect,
    logout: auth0.logout,
  }
}
