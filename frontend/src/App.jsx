import { useEffect, useMemo, useState } from 'react'
import './App.css'

function App() {
  const [authMode, setAuthMode] = useState('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authError, setAuthError] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem('access_token') || '')
  const [attemptsRemaining, setAttemptsRemaining] = useState(null)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const apiBase = useMemo(() => import.meta.env.VITE_API_URL || '/api', [])

  const fetchMe = async (activeToken) => {
    if (!activeToken) {
      setAttemptsRemaining(null)
      return
    }

    try {
      const response = await fetch(`${apiBase}/me`, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          setAttemptsRemaining(null)
        }
        return
      }

      const payload = await response.json()
      setAttemptsRemaining(payload.attempts_remaining)
    } catch {
      setAttemptsRemaining(null)
    }
  }

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    fetchMe(token)
  }, [token])

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setAuthMessage('')

    if (!authUsername.trim() || !authPassword) {
      setAuthError('Username and password required.')
      return
    }

    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
    try {
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: authUsername.trim(),
          password: authPassword,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Authentication failed.')
      }

      if (authMode === 'register') {
        setAuthMessage('Registered successfully. Please login.')
        setAuthMode('login')
        return
      }

      const payload = await response.json()
      const accessToken = payload.access_token
      localStorage.setItem('access_token', accessToken)
      setToken(accessToken)
      setAuthMessage('Logged in.')
      setAuthPassword('')
    } catch (err) {
      setAuthError(err.message || 'Authentication failed.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    setToken('')
    setAttemptsRemaining(null)
    setResults([])
    setError('')
  }

  const handleFileChange = (event) => {
    const nextFile = event.target.files && event.target.files[0]
    setFile(nextFile || null)
    setResults([])
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setResults([])

    if (!token) {
      setError('Please login.')
      return
    }

    if (!file) {
      setError('Choose an image to classify.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      setIsLoading(true)
      const response = await fetch(`${apiBase}/classify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please login.')
          return
        }
        if (response.status === 403) {
          setError('No attempts remaining.')
          setAttemptsRemaining(0)
          return
        }
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Classification failed.')
      }

      const payload = await response.json()
      const sorted = (payload.predictions || []).slice().sort((a, b) => b.score - a.score)
      setResults(sorted)
      await fetchMe(token)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <span className="badge">Vision Transformer</span>
        <h1>Single Image Classification</h1>
        <p>
          Upload one image and let <strong>google/vit-base-patch16-224</strong> predict the
          top labels in seconds.
        </p>
      </header>

      <main className="panel">
        <section className="auth-panel">
          <div className="auth-header">
            <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
            <div className="auth-actions">
              {token ? (
                <button className="ghost" type="button" onClick={handleLogout}>
                  Logout
                </button>
              ) : (
                <button
                  className="ghost"
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                >
                  {authMode === 'login' ? 'Need an account?' : 'Have an account?'}
                </button>
              )}
            </div>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <input
              className="auth-input"
              type="text"
              placeholder="Username"
              value={authUsername}
              onChange={(event) => setAuthUsername(event.target.value)}
            />
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
            />
            <button className="primary" type="submit">
              {authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>

          {authMessage && <p className="notice">{authMessage}</p>}
          {authError && <p className="error">{authError}</p>}
          <div className="attempts">
            <span>Attempts remaining:</span>
            <strong>{attemptsRemaining ?? '—'}</strong>
          </div>
        </section>

        <form className="upload" onSubmit={handleSubmit}>
          <label htmlFor="image" className="file-label">
            <span>Pick an image</span>
            <input id="image" type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          <button
            className="primary"
            type="submit"
            disabled={isLoading || attemptsRemaining === 0}
          >
            {isLoading ? 'Classifying...' : 'Classify Image'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>

        <section className="preview">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" />
          ) : (
            <div className="placeholder">
              <p>Drop in a photo to see predictions.</p>
            </div>
          )}
        </section>

        <section className="results">
          <h2>Top predictions</h2>
          {results.length === 0 ? (
            <p className="muted">Predictions will appear here after classification.</p>
          ) : (
            <ul>
              {results.map((item) => (
                <li key={item.label}>
                  <div className="result-row">
                    <span className="label">{item.label}</span>
                    <span className="score">{(item.score * 100).toFixed(2)}%</span>
                  </div>
                  <div className="meter">
                    <span style={{ width: `${Math.min(item.score * 100, 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
