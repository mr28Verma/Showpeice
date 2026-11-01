import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { SignUpModal } from './components/SignUpModal'

function AuthFrame({ children, title, description, providedAuth = false }: { children: ReactNode; title?: string; description?: string; providedAuth?: boolean }) {
  return <main className="auth-page">
    <section className="auth-art" aria-label="Showpeice gallery">
      <img src="https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=85" alt="A quiet gallery wall with original artwork" onError={(event) => { event.currentTarget.style.display = 'none' }}/>
      <Link className="auth-art-brand" to="/"><img className="brand-logo" src="/showpeice-logo.svg" alt=""/><strong>Showpeice</strong></Link>
      <div className="auth-art-copy"><p className="auth-art-headline">Art that<br/>speaks to you.</p><p className="auth-art-supporting">Discover original works. Meet independent artists. Find something worth keeping.</p></div><span className="auth-art-caption">ORIGINAL WORKS · INDEPENDENT ARTISTS</span>
    </section>
    <section className={providedAuth ? 'auth-panel auth-panel-provided' : 'auth-panel'}>
      <Link className="auth-mobile-brand" to="/"><img className="brand-logo" src="/showpeice-logo.svg" alt=""/><strong>Showpeice</strong></Link>
      <div className={providedAuth ? 'auth-form-wrap auth-form-wrap-provided' : 'auth-form-wrap'}>{providedAuth ? children : <><div className="eyebrow"><span className="eyebrow-line"/> SHOWPEICE ACCOUNT</div><h1>{title}</h1><p className="auth-description">{description}</p>{children}</>}</div>
      <div className="auth-footnote">A HOME FOR ART THAT MEANS SOMETHING.</div>
    </section>
  </main>
}

export function LoginPage() {
  const [searchParams] = useSearchParams()
  return <AuthFrame providedAuth><SignUpModal key={searchParams.get('role') ?? 'default'}/></AuthFrame>
}

export function RegisterPage() {
  const [searchParams] = useSearchParams()
  return <AuthFrame providedAuth><SignUpModal key={`signup-${searchParams.get('role') ?? 'default'}`} initialTab="signup"/></AuthFrame>
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const location = useLocation()
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('Password recovery is not connected yet. Connect an authentication backend to send a reset link.')
  }

  return <AuthFrame title="A fresh start." description="Enter your account email and weâ€™ll help you find your way back.">
    <form className="auth-form" onSubmit={submit}><div className="auth-field"><label htmlFor="recovery-email">Email address</label><input id="recovery-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)}/></div><button className="auth-submit" type="submit">Send reset link <ArrowRight size={16}/></button>{message && <p className="auth-status" role="status">{message}</p>}</form>
    <p className="auth-switch"><Link to={`/login${location.search}`}>Back to sign in</Link></p>
  </AuthFrame>
}

