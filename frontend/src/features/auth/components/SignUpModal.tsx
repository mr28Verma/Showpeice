import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FloatingInput, FloatingLabel } from '@/components/ui/floating-label-input'
import { toast } from '../../../components/ui/toast'
import { apiUrl } from '../../../lib/api'
import { getSafeReturnTo } from '../../../lib/authRedirect'
import { saveAuthSession } from '../../../lib/authSession'
import styles from './SignUpModal.module.css'

type Tab = 'signup' | 'signin'
type Role = 'seller' | 'buyer'
type FieldName = 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword'
type FieldErrors = Partial<Record<FieldName, string>>
type AuthValues = Record<FieldName, string>
type RegistrationRequest = { firstName: string; lastName: string; email: string; password: string; role: Role }
type RegistrationResponse = { message?: string; error?: string; token?: string; user?: { id: number; firstName: string; lastName: string; email: string; role: string } }

function validateField(field: FieldName, values: AuthValues, isSignUp: boolean) {
  if (field === 'firstName') {
    if (!values.firstName.trim()) return 'Enter your first name.'
    if (values.firstName.trim().length < 3) return 'First name must be at least 3 characters.'
  }

  if (field === 'lastName' && !values.lastName.trim()) return 'Enter your last name.'

  if (field === 'email') {
    if (!values.email.trim()) return 'Enter your email address.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return 'Enter a valid email address.'
  }

  if (field === 'password') {
    if (!values.password) return 'Enter your password.'
    if (isSignUp && values.password.length < 8) return 'Password must be at least 8 characters.'
  }

  if (field === 'confirmPassword') {
    if (!values.confirmPassword) return 'Confirm your password.'
    if (values.password !== values.confirmPassword) return 'Passwords do not match.'
  }

  return ''
}

export function SignUpModal({ initialTab = 'signin' }: { initialTab?: Tab }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const roleParam = searchParams.get('role')
  const currentQuery = searchParams.toString()
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [signUpStep, setSignUpStep] = useState<1 | 2>(1)
  const [role, setRole] = useState<Role>(() => roleParam === 'artist' ? 'seller' : 'buyer')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const values: AuthValues = { firstName, lastName, email, password, confirmPassword }
  const fieldSetters: Record<FieldName, (value: string) => void> = {
    firstName: setFirstName,
    lastName: setLastName,
    email: setEmail,
    password: setPassword,
    confirmPassword: setConfirmPassword,
  }

  const errorFor = (field: FieldName) => {
    if (touched[field]) return validateField(field, values, activeTab === 'signup') || serverErrors[field] || ''
    return serverErrors[field] || ''
  }

  const changeField = (field: FieldName, value: string) => {
    fieldSetters[field](value)
    if (serverErrors[field]) setServerErrors((current) => ({ ...current, [field]: undefined }))
  }

  const markTouched = (field: FieldName) => {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  const switchTab = (tab: Tab) => {
    setActiveTab(tab)
    setSignUpStep(1)
    setTouched({})
    setServerErrors({})
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fields: FieldName[] = activeTab === 'signin'
      ? ['email', 'password']
      : signUpStep === 1
        ? ['firstName', 'lastName', 'email']
        : ['password', 'confirmPassword']

    setTouched((current) => {
      const next = { ...current }
      fields.forEach((field) => { next[field] = true })
      return next
    })

    if (fields.some((field) => validateField(field, values, activeTab === 'signup'))) return

    if (activeTab === 'signup' && signUpStep === 1) {
      setSignUpStep(2)
      return
    }

    const normalizedEmail = email.trim()
    const payload: RegistrationRequest = { firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, password, role }
    const isSignIn = activeTab === 'signin'
    setIsSubmitting(true)

    try {
      const response = await fetch(apiUrl(`/auth/${isSignIn ? 'login' : 'register'}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch((): RegistrationResponse => ({})) as RegistrationResponse

      if (!response.ok) {
        if (isSignIn) {
          if (response.status === 401) {
            toast.error('Sign in failed', 'Check your email and password, then try again.')
          } else if (response.status >= 500) {
            toast.error('Sign in unavailable', 'The account service is unavailable. Please try again shortly.')
          } else {
            toast.error('Sign in failed', result.message || 'We could not sign you in. Please try again.')
          }
        } else if (response.status === 409) {
          setServerErrors((current) => ({ ...current, email: 'An account with this email already exists.' }))
          setTouched((current) => ({ ...current, email: true }))
          setSignUpStep(1)
        } else {
          toast.error('Account creation failed', result.message || 'Check your details and try again.')
        }
        return
      }

      if (isSignIn) {
        if (typeof result.token !== 'string' || !result.token ||
            !result.user || typeof result.user.id !== 'number' ||
            typeof result.user.firstName !== 'string' || typeof result.user.lastName !== 'string' ||
            typeof result.user.email !== 'string' || typeof result.user.role !== 'string') {
          toast.error('Sign in failed', 'The server returned incomplete account information. Please try again.')
          return
        }
        if (!['buyer', 'seller', 'artist'].includes(result.user.role)) {
          toast.error('Sign in failed', 'This account has an unsupported role. Please contact Showpeice support.')
          return
        }
        saveAuthSession(result.token, result.user)
        const accountRole = result.user.role === 'seller' || result.user.role === 'artist' ? 'artist' : 'buyer'
        const returnTo = getSafeReturnTo(searchParams.get('returnTo'), accountRole)
        if (returnTo) {
          toast.success('Signed in', 'You are ready to continue.')
          navigate(returnTo)
          return
        }
        if (accountRole === 'artist') {
          toast.success('Welcome back', 'You are signed in to your artist studio.')
          navigate('/artist/dashboard')
          return
        }
        toast.success('Welcome back', 'You are signed in to your collector desk.')
        navigate('/gallery')
        return
      }

      setPassword('')
      setConfirmPassword('')
      setTouched({})
      setServerErrors({})
      toast.success('Account created', result.message || 'Your account is ready. You can now sign in.')
      setActiveTab('signin')
      setSignUpStep(1)
    } catch (error) {
      console.error('[auth] Request failed', error)
      toast.error(isSignIn ? 'Sign in failed' : 'Account creation failed', 'We could not reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const fieldClasses = (field: FieldName) => errorFor(field) ? `${styles.inputGroup} ${styles.invalidGroup}` : styles.inputGroup
  const errorMessage = (field: FieldName, id: string) => errorFor(field)
    ? <span className={styles.fieldError} id={id} aria-live="polite">{errorFor(field)}</span>
    : null

  return <div className={styles.authContent}>
    <div className={styles.tabToggle} role="group" aria-label="Choose sign in or sign up">
      <span className={`${styles.tabGlider} ${activeTab === 'signin' ? styles.gliderRight : ''}`} aria-hidden="true"/>
      <button className={`${styles.tabBtn} ${activeTab === 'signup' ? styles.activeText : ''}`} type="button" aria-pressed={activeTab === 'signup'} onClick={() => switchTab('signup')}>Sign up</button>
      <button className={`${styles.tabBtn} ${activeTab === 'signin' ? styles.activeText : ''}`} type="button" aria-pressed={activeTab === 'signin'} onClick={() => switchTab('signin')}>Sign in</button>
    </div>

    <div className={styles.headerRow}>
      {activeTab === 'signup' && signUpStep === 2 && <button type="button" className={styles.backArrowBtn} onClick={() => { setSignUpStep(1); setTouched({}) }} aria-label="Back to your details"><ArrowLeft size={16}/></button>}
      <div><div className={styles.eyebrow}>SHOWPEICE ACCOUNT</div><h1 className={styles.title}>{activeTab === 'signin' ? 'Welcome back.' : signUpStep === 1 ? 'Create an account.' : 'Set your password.'}</h1><p className={styles.intro}>{activeTab === 'signin' ? 'Sign in to find your saved works and continue collecting.' : signUpStep === 1 ? 'Join a thoughtful community of artists and collectors.' : 'Choose a secure password for your new account.'}</p></div>
    </div>

    <form onSubmit={handleSubmit} className={styles.form} noValidate aria-busy={isSubmitting}>
      {activeTab === 'signup' && signUpStep === 1 ? <>
        <fieldset className={styles.roleSelector}><legend className={styles.fieldLabel}>I AM HERE TO</legend>
          <button type="button" className={`${styles.roleCard} ${role === 'seller' ? styles.roleActive : ''}`} aria-pressed={role === 'seller'} onClick={() => setRole('seller')}><strong>Artist / Seller</strong><span>Exhibit and sell your art</span></button>
          <button type="button" className={`${styles.roleCard} ${role === 'buyer' ? styles.roleActive : ''}`} aria-pressed={role === 'buyer'} onClick={() => setRole('buyer')}><strong>Collector / Buyer</strong><span>Discover and collect art</span></button>
        </fieldset>
        <div className={styles.inputRow}>
          <div className={fieldClasses('firstName')}>
            <div className="showpeice-floating-field">
              <FloatingInput id="signup-first-name" name="firstName" autoComplete="given-name" type="text" value={firstName} onChange={(event) => changeField('firstName', event.target.value)} onBlur={() => markTouched('firstName')} required minLength={3} aria-invalid={Boolean(errorFor('firstName'))} aria-describedby={errorFor('firstName') ? 'signup-first-name-error' : undefined}/>
              <FloatingLabel htmlFor="signup-first-name">First name</FloatingLabel>
            </div>
            {errorMessage('firstName', 'signup-first-name-error')}
          </div>
          <div className={fieldClasses('lastName')}>
            <div className="showpeice-floating-field">
              <FloatingInput id="signup-last-name" name="lastName" autoComplete="family-name" type="text" value={lastName} onChange={(event) => changeField('lastName', event.target.value)} onBlur={() => markTouched('lastName')} required aria-invalid={Boolean(errorFor('lastName'))} aria-describedby={errorFor('lastName') ? 'signup-last-name-error' : undefined}/>
              <FloatingLabel htmlFor="signup-last-name">Last name</FloatingLabel>
            </div>
            {errorMessage('lastName', 'signup-last-name-error')}
          </div>
        </div>
        <div className={fieldClasses('email')}>
          <div className="showpeice-floating-field">
            <FloatingInput id="signup-email" name="email" autoComplete="email" type="email" value={email} onChange={(event) => changeField('email', event.target.value)} onBlur={() => markTouched('email')} required aria-invalid={Boolean(errorFor('email'))} aria-describedby={errorFor('email') ? 'signup-email-error' : undefined}/>
            <FloatingLabel htmlFor="signup-email">Email address</FloatingLabel>
          </div>
          {errorMessage('email', 'signup-email-error')}
        </div>
        <button type="submit" className={styles.submitBtn}>Continue <ArrowRight size={16}/></button>
      </> : activeTab === 'signup' ? <>
        <div className={fieldClasses('password')}>
          <div className={`showpeice-floating-field ${styles.passwordField}`}>
            <FloatingInput id="signup-password" name="password" autoComplete="new-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => changeField('password', event.target.value)} onBlur={() => markTouched('password')} minLength={8} required aria-invalid={Boolean(errorFor('password'))} aria-describedby={errorFor('password') ? 'signup-password-error' : undefined}/>
            <FloatingLabel htmlFor="signup-password">Password</FloatingLabel>
            <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          </div>
          {errorMessage('password', 'signup-password-error')}
        </div>
        <div className={fieldClasses('confirmPassword')}>
          <div className={`showpeice-floating-field ${styles.passwordField}`}>
            <FloatingInput id="signup-confirm-password" name="confirmPassword" autoComplete="new-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => changeField('confirmPassword', event.target.value)} onBlur={() => markTouched('confirmPassword')} minLength={8} required aria-invalid={Boolean(errorFor('confirmPassword'))} aria-describedby={errorFor('confirmPassword') ? 'signup-confirm-password-error' : undefined}/>
            <FloatingLabel htmlFor="signup-confirm-password">Confirm password</FloatingLabel>
            <button type="button" className={styles.passwordToggle} onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          </div>
          {errorMessage('confirmPassword', 'signup-confirm-password-error')}
        </div>
        <button type="submit" className={styles.submitBtn} disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? <>Creating account... <LoaderCircle className={styles.loadingIcon} size={16} aria-hidden="true"/></> : <>Create {role === 'seller' ? 'Artist' : 'Collector'} Account <ArrowRight size={16} aria-hidden="true"/></>}</button>
      </> : <>
        <div className={fieldClasses('email')}>
          <div className="showpeice-floating-field">
            <FloatingInput id="signin-email" name="email" autoComplete="email" type="email" value={email} onChange={(event) => changeField('email', event.target.value)} onBlur={() => markTouched('email')} required aria-invalid={Boolean(errorFor('email'))} aria-describedby={errorFor('email') ? 'signin-email-error' : undefined}/>
            <FloatingLabel htmlFor="signin-email">Email address</FloatingLabel>
          </div>
          {errorMessage('email', 'signin-email-error')}
        </div>
        <div className={fieldClasses('password')}>
          <div className={`showpeice-floating-field ${styles.passwordField}`}>
            <FloatingInput id="signin-password" name="password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => changeField('password', event.target.value)} onBlur={() => markTouched('password')} required aria-invalid={Boolean(errorFor('password'))} aria-describedby={errorFor('password') ? 'signin-password-error' : undefined}/>
            <FloatingLabel htmlFor="signin-password">Password</FloatingLabel>
            <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          </div>
          {errorMessage('password', 'signin-password-error')}
        </div>
        <div className={styles.formOptions}><label className={styles.remember}><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)}/> Remember me</label><Link to={`/forgot-password${currentQuery ? `?${currentQuery}` : ''}`}>Forgot password?</Link></div>
        <button type="submit" className={styles.submitBtn} disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? <>Signing in... <LoaderCircle className={styles.loadingIcon} size={16} aria-hidden="true"/></> : <>Sign in <ArrowRight size={16} aria-hidden="true"/></>}</button>
      </>}
    </form>

    <div className={styles.divider}><span>{activeTab === 'signup' ? 'OR SIGN UP WITH' : 'OR SIGN IN WITH'}</span></div>
    <div className={styles.socialRow}>
      <button type="button" className={styles.socialBtn} disabled title="Google sign-in is not configured" aria-label="Google sign-in is not configured"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#7f7f7f" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/><path fill="#898989" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/><path fill="#bcbcbc" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.8s.7 5.1 1.9 7.5l3.7-2.9c-.2-.7-.4-1.5-.4-2.3z"/><path fill="#656565" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/></svg><span>Google</span></button>
      <button type="button" className={styles.socialBtn} disabled title="Apple sign-in is not configured" aria-label="Apple sign-in is not configured"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.7 19.5c-.8 1.2-1.7 2.4-3 2.5-1.4 0-1.8-.8-3.3-.8-1.6 0-2 .8-3.3.8-1.3.1-2.3-1.3-3.1-2.5-2.2-3.3-2.4-7.5-.6-10.1.9-1.4 2.4-2.3 4-2.4 1.3 0 2.5.9 3.3.9.8 0 2.3-1.1 3.8-.9.7 0 2.5.3 3.7 2-.1.1-2.2 1.3-2.1 3.8 0 3 2.6 4 2.7 4-.1.1-.5 1.4-1.4 2.8M16 6.3c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.4-.6.7-1 1.7-.9 2.8 1 .1 2-.5 2.6-1.3z"/></svg><span>Apple</span></button>
    </div>
    <p className={styles.providerNote}>Google and Apple sign-in are currently unavailable.</p>
    {activeTab === 'signup' && <p className={styles.termsText}>By creating an account, you agree to our <Link to="/#newsletter">Terms &amp; Service</Link>.</p>}
  </div>
}
