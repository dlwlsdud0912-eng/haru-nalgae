'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Tab = 'login' | 'signup';

/* ── Abstract brand symbol (inline SVG) ── */
function BrandSymbol({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Wing-like abstract curves */}
      <path
        d="M60 20C40 20 24 36 24 56c0 14 8 26 20 32"
        stroke="#5C8A73"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M60 20c20 0 36 16 36 36 0 14-8 26-20 32"
        stroke="#7BAA92"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M44 88c8 8 20 12 32 8"
        stroke="#3F6B57"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Trajectory arc — wing trail */}
      <path
        d="M30 70Q45 40 60 50T90 45"
        stroke="#5C8A73"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <circle cx="60" cy="56" r="4" fill="#3F6B57" opacity="0.5" />
      <circle cx="60" cy="56" r="1.5" fill="#3F6B57" opacity="0.8" />
    </svg>
  );
}

/* ── Small symbol mark for form header ── */
function SymbolMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8 22C8 14.268 14.268 8 22 8"
        stroke="#5C8A73"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 24c5-2 9-6 11-11"
        stroke="#7BAA92"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2" fill="#3F6B57" opacity="0.6" />
    </svg>
  );
}

/* ── Eye icon for password toggle ── */
function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/* ── Error icon ── */
function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/* ── Spinner ── */
function Spinner() {
  return (
    <svg className="login-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M12 2a10 10 0 019.17 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ══════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════ */
export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Signup form
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupPwConfirm, setShowSignupPwConfirm] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      const data = await res.json();
      if (data.success) {
        router.push('/app');
      } else {
        setError(data.error || '로그인에 실패했습니다.');
      }
    } catch {
      setError('서버와 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (signupPassword !== signupPasswordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: signupUsername,
          password: signupPassword,
          displayName: signupDisplayName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push('/app');
      } else {
        setError(data.error || '회원가입에 실패했습니다.');
      }
    } catch {
      setError('서버와 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    setError('');
  };

  return (
    <div className="login-page">
      {/* ───── Left: Brand Panel ───── */}
      <div className="login-brand">
        {/* Gradient layers */}
        <div className="login-brand-gradient" />
        <div className="login-brand-noise" />

        {/* Floating abstract objects */}
        <div className="login-brand-objects">
          {/* Card-like shapes representing schedule items */}
          <div className="login-obj login-obj-card-1" />
          <div className="login-obj login-obj-card-2" />
          <div className="login-obj login-obj-card-3" />
          {/* Circle — clock motif */}
          <div className="login-obj login-obj-circle" />
          {/* Curve line */}
          <div className="login-obj login-obj-arc">
            <svg viewBox="0 0 200 100" fill="none" aria-hidden="true">
              <path d="M10 80Q60 10 110 50T190 30" stroke="#5C8A73" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
            </svg>
          </div>
        </div>

        {/* Brand content */}
        <div className="login-brand-content">
          <BrandSymbol className="login-brand-symbol" />
          <h1 className="login-brand-title">하루날개</h1>
          <p className="login-brand-subtitle">
            하루를 정돈하고,<br />가볍게 시작하세요.
          </p>

          <div className="login-brand-benefits">
            <div className="login-benefit">
              <span className="login-benefit-dot" />
              <span>AI가 당신의 일정을 정리합니다</span>
            </div>
            <div className="login-benefit">
              <span className="login-benefit-dot" />
              <span>중요한 것에만 집중하세요</span>
            </div>
            <div className="login-benefit">
              <span className="login-benefit-dot" />
              <span>매일 아침, 깔끔한 하루의 시작</span>
            </div>
          </div>
        </div>
      </div>

      {/* ───── Right: Form Panel ───── */}
      <div className="login-form-panel">
        <div className="login-form-wrapper">
          {/* Form header */}
          <div className="login-form-header">
            <div className="login-form-logo">
              <SymbolMark className="login-form-symbol" />
              <span className="login-form-brand">하루날개</span>
            </div>
            <p className="login-form-desc">
              {tab === 'login' ? '다시 돌아오셨군요. 반갑습니다.' : '새로운 하루를 함께 시작해요.'}
            </p>
          </div>

          {/* Pill tab */}
          <div className="login-tab-container" role="tablist">
            <div
              className="login-tab-indicator"
              style={{ transform: tab === 'login' ? 'translateX(0)' : 'translateX(100%)' }}
            />
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              onClick={() => switchTab('login')}
              className={`login-tab-btn ${tab === 'login' ? 'login-tab-active' : ''}`}
            >
              로그인
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signup'}
              onClick={() => switchTab('signup')}
              className={`login-tab-btn ${tab === 'signup' ? 'login-tab-active' : ''}`}
            >
              회원가입
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error" role="alert">
              <ErrorIcon />
              <span>{error}</span>
            </div>
          )}

          {/* ── Login Form ── */}
          <div className="login-form-area">
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="login-form login-form-enter">
                <div className="login-field">
                  <label htmlFor="login-username" className="login-label">아이디</label>
                  <input
                    id="login-username"
                    type="text"
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    className="login-input"
                    placeholder="아이디를 입력하세요"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="login-password" className="login-label">비밀번호</label>
                  <div className="login-input-wrap">
                    <input
                      id="login-password"
                      type={showLoginPw ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      className="login-input login-input-pw"
                      placeholder="비밀번호를 입력하세요"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="login-pw-toggle"
                      onClick={() => setShowLoginPw(v => !v)}
                      aria-label={showLoginPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                      tabIndex={-1}
                    >
                      <EyeIcon open={showLoginPw} />
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="login-cta">
                  {loading ? (
                    <span className="login-cta-loading"><Spinner /> 로그인 중...</span>
                  ) : (
                    '로그인'
                  )}
                </button>

                <p className="login-trust">30초면 시작할 수 있어요</p>
              </form>
            )}

            {/* ── Signup Form ── */}
            {tab === 'signup' && (
              <form onSubmit={handleSignup} className="login-form login-form-enter">
                <div className="login-field">
                  <label htmlFor="signup-username" className="login-label">아이디</label>
                  <input
                    id="signup-username"
                    type="text"
                    value={signupUsername}
                    onChange={e => setSignupUsername(e.target.value)}
                    className="login-input"
                    placeholder="2~20자 영문, 한글, 숫자"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="signup-displayname" className="login-label">표시 이름</label>
                  <input
                    id="signup-displayname"
                    type="text"
                    value={signupDisplayName}
                    onChange={e => setSignupDisplayName(e.target.value)}
                    className="login-input"
                    placeholder="다른 사용자에게 보여질 이름"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="signup-password" className="login-label">비밀번호</label>
                  <div className="login-input-wrap">
                    <input
                      id="signup-password"
                      type={showSignupPw ? 'text' : 'password'}
                      value={signupPassword}
                      onChange={e => setSignupPassword(e.target.value)}
                      className="login-input login-input-pw"
                      placeholder="최소 4자 이상"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="login-pw-toggle"
                      onClick={() => setShowSignupPw(v => !v)}
                      aria-label={showSignupPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                      tabIndex={-1}
                    >
                      <EyeIcon open={showSignupPw} />
                    </button>
                  </div>
                </div>

                <div className="login-field">
                  <label htmlFor="signup-password-confirm" className="login-label">비밀번호 확인</label>
                  <div className="login-input-wrap">
                    <input
                      id="signup-password-confirm"
                      type={showSignupPwConfirm ? 'text' : 'password'}
                      value={signupPasswordConfirm}
                      onChange={e => setSignupPasswordConfirm(e.target.value)}
                      className="login-input login-input-pw"
                      placeholder="비밀번호를 다시 입력하세요"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="login-pw-toggle"
                      onClick={() => setShowSignupPwConfirm(v => !v)}
                      aria-label={showSignupPwConfirm ? '비밀번호 숨기기' : '비밀번호 보기'}
                      tabIndex={-1}
                    >
                      <EyeIcon open={showSignupPwConfirm} />
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="login-cta">
                  {loading ? (
                    <span className="login-cta-loading"><Spinner /> 가입 중...</span>
                  ) : (
                    '시작하기'
                  )}
                </button>

                <p className="login-trust">가입 후 바로 일정을 정리할 수 있어요</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
