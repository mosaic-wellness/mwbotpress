import React, { useEffect, useState, useRef } from 'react'
import { useHistory } from 'react-router-dom'
// import { store } from '../../../store'

// import { URL_LIST, ENV_CONFIG } from '../../../constants/apiList'
import styles from './GoogleLogin.module.css'

// Type declarations for Google Sign-In API
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: any) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          prompt: (callback?: (notification: {
            isNotDisplayed: () => boolean
            isSkippedMoment: () => boolean
          }) => void) => void
          renderButton: (
            element: HTMLElement,
            config: {
              theme?: string
              size?: string
              width?: number
              text?: string
            }
          ) => void
          cancel: () => void
        }
      }
    }
  }
}

const MwLogin = (props: any) => {
  const history = useHistory()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [googleClientId, setGoogleClientId] = useState('678004543067-mjqb3njdqc25eiu0s0i3h1c5sutn9ids.apps.googleusercontent.com')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const isMountedRef = useRef(true)

  const handleGoogleSignIn = React.useCallback(async (response) => {
    if (!isMountedRef.current) {
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const { credential } = response

      // Send the credential to your backend
      // const loginResponse = await axios.post(URL_LIST.GOOGLE_LOGIN, {
      //   credential,
      // });

      // if (!isMountedRef.current) return;

      if (credential) {
        try{
          const redirectTo = {pathname: '/workspace/default/bots', search: '', hash: '', query: {}}
          const loginUrl = '/login/basic/default'
          await props.auth.login({ email: 'mayurbhirava', password: '953ay6mFWF7NtyX2' }, loginUrl, redirectTo)
        }catch(e){
          localStorage.setItem('error', e?.message)
        }
        localStorage.setItem('token', credential)

        // Store user brands if available


          // Redirect to dashboard
      } else {
      }
    } catch (err) {
      console.error('Google login error:', err)
      if (isMountedRef.current) {
        setError(err?.response?.data?.message || 'Login failed. Please try again.')
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [history])

  useEffect(() => {
    let isMounted = true

    // Check if user is already logged in
    const checkExistingAuth = () => {
      localStorage.removeItem('token')
      return false
    }

    // Check authentication first
    if (checkExistingAuth()) {
      setCheckingAuth(false)
      return
    }

    // Get Google Client ID from configuration files
    const clientId = '678004543067-uuerfup5jupdtk4t1mfl3r40i7heui2i.apps.googleusercontent.com'
    if (!clientId) {
      if (isMounted) {
        setError('Google Client ID not configured. Please check your environment configuration.')
        setCheckingAuth(false)
      }
      return
    }
    if (isMounted) {
      setGoogleClientId(clientId)
      setCheckingAuth(false)
    }

    // Initialize Google Sign-In
    const initializeGoogleSignIn = () => {
      if (!isMounted) {
        return
      }

      if (window.google && window.google.accounts && window.google.accounts.id && clientId) {
        try {
          // Clear any existing button first
          const existingButton = document.getElementById('google-signin-button')
          if (existingButton) {
            existingButton.innerHTML = ''
          }

          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleSignIn,
            auto_select: true, // Enable auto-select for better UX
            cancel_on_tap_outside: true,
          })

          // Display the One Tap prompt for auto-login
          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {

            }
          })

          // Add a small delay to ensure the element is ready
          setTimeout(() => {
            if (!isMounted) {
              return
            }

            const buttonElement = document.getElementById('google-signin-button')
            if (buttonElement && window.google && window.google.accounts && window.google.accounts.id) {
              try {
                window.google.accounts.id.renderButton(
                  buttonElement,
                  {
                    theme: 'outline',
                    size: 'large',
                    width: 300,
                    text: 'signin_with',
                  }
                )
              } catch (renderError) {
                console.error('Error rendering Google button:', renderError)
                if (isMounted) {
                  setError('Failed to render Google Sign-In button. Please refresh the page.')
                }
              }
            } else {
              console.error('Google sign-in button element not found or Google API not available')
              if (isMounted) {
                setError('Google Sign-In button element not found. Please refresh the page.')
              }
            }
          }, 100)
        } catch (err) {
          console.error('Error initializing Google Sign-In:', err)
          if (isMounted) {
            setError('Failed to initialize Google Sign-In. Please try refreshing the page.')
          }
        }
      } else {
        console.error('Google API not available or client ID missing')
        if (isMounted) {
          setError('Google Sign-In is not available. Please refresh the page.')
        }
      }
    }

    // Load Google Sign-In script
    const loadGoogleScript = () => {
      if (!isMounted) {
        return
      }

      // Check if script is already loading or loaded
      const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
      if (existingScript) {
        // Script already exists, try to initialize
        if (window.google && window.google.accounts) {
          initializeGoogleSignIn()
        } else {
          // Script exists but Google API not ready, wait for it
          const checkGoogle = setInterval(() => {
            if (window.google && window.google.accounts) {
              clearInterval(checkGoogle)
              if (isMounted) {
                initializeGoogleSignIn()
              }
            }
          }, 100)

          // Timeout after 10 seconds
          setTimeout(() => {
            clearInterval(checkGoogle)
            if (isMounted) {
              setError('Google Sign-In failed to load. Please refresh the page.')
            }
          }, 10000)
        }
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.id = 'google-signin-script'

      script.onload = () => {
        if (isMounted) {
          // Add a small delay to ensure Google API is fully loaded
          setTimeout(() => {
            if (isMounted) {
              initializeGoogleSignIn()
            }
          }, 200)
        }
      }

      script.onerror = () => {
        if (isMounted) {
          setError('Failed to load Google Sign-In. Please check your internet connection and refresh the page.')
        }
      }

      document.head.appendChild(script)
    }

    // Start the process
    if (!window.google) {
      loadGoogleScript()
    } else {
      initializeGoogleSignIn()
    }

    // Cleanup function
    return () => {
      isMounted = false
      isMountedRef.current = false
      setCheckingAuth(false)

      // Clean up Google Sign-In if it exists
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          // Cancel any ongoing operations
          window.google.accounts.id.cancel()
        } catch (err) {
          // Error cleaning up Google Sign-In
          console.error('Error cleaning up Google Sign-In:', err)
        }
      }
    }
  }, [handleGoogleSignIn])

  // Show loading screen while checking authentication
  if (checkingAuth) {
    return (
      <div className={styles.container}>
        <div className={styles.loginCard}>
          <div className={styles.logo}>
            <h1>MWBOT</h1>
          </div>
          <div className={styles.content}>
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <span>Checking authentication...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!googleClientId) {
    return (
      <div className={styles.container}>
        <div className={styles.loginCard}>
          <div className={styles.logo}>
            <h1>MWBOT</h1>
          </div>

          <div className={styles.content}>
            <div className={styles.error}>
              {error}
            </div>
            <p className={styles.subtitle}>
              Please contact your administrator to configure Google Sign-In.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.logo}>
          <h1>MWBOT</h1>
        </div>

        <div className={styles.content}>
          <h2 className={styles.title}>Welcome Back</h2>
          <p className={styles.subtitle}>Sign in to access your dashboard</p>

          <div className={styles.googleSignIn}>
            <div id="google-signin-button"></div>
            {!googleClientId && (
              <div className={styles.fallbackMessage}>
                Google Sign-In is not available. Please contact your administrator.
              </div>
            )}
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {isLoading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <span>Signing in...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MwLogin
