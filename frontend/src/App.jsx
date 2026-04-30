import { useEffect, useMemo, useState } from 'react'
import './App.css'

function App() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const apiBase = useMemo(() => import.meta.env.VITE_API_URL || '/api', [])

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

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
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Classification failed.')
      }

      const payload = await response.json()
      const sorted = (payload.predictions || []).slice().sort((a, b) => b.score - a.score)
      setResults(sorted)
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
        <form className="upload" onSubmit={handleSubmit}>
          <label htmlFor="image" className="file-label">
            <span>Pick an image</span>
            <input id="image" type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          <button className="primary" type="submit" disabled={isLoading}>
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
