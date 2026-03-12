'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Tab = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 로그인 폼
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 회원가입 폼
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');

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

  return (
    <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-[#1F2937]">
            <span role="img" aria-label="dove">🕊️</span> 하루날개
          </h1>
          <p className="text-sm text-[#64748B] mt-1">매일의 일상에 날개를 달다</p>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(''); }}
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${
              tab === 'login'
                ? 'text-[#34D399] border-b-2 border-[#34D399]'
                : 'text-[#9CA3AF] hover:text-[#6B7280]'
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setError(''); }}
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${
              tab === 'signup'
                ? 'text-[#34D399] border-b-2 border-[#34D399]'
                : 'text-[#9CA3AF] hover:text-[#6B7280]'
            }`}
          >
            회원가입
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        {/* 로그인 폼 */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-[#374151] mb-1">
                아이디
              </label>
              <input
                id="login-username"
                type="text"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#34D399] focus:border-transparent"
                placeholder="아이디를 입력하세요"
                required
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-[#374151] mb-1">
                비밀번호
              </label>
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#34D399] focus:border-transparent"
                placeholder="비밀번호를 입력하세요"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#34D399] hover:bg-[#6EE7B7] text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        )}

        {/* 회원가입 폼 */}
        {tab === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="signup-username" className="block text-sm font-medium text-[#374151] mb-1">
                아이디
              </label>
              <input
                id="signup-username"
                type="text"
                value={signupUsername}
                onChange={e => setSignupUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#34D399] focus:border-transparent"
                placeholder="2~20자 영문, 한글, 숫자"
                required
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-[#374151] mb-1">
                비밀번호
              </label>
              <input
                id="signup-password"
                type="password"
                value={signupPassword}
                onChange={e => setSignupPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#34D399] focus:border-transparent"
                placeholder="최소 4자 이상"
                required
              />
            </div>
            <div>
              <label htmlFor="signup-password-confirm" className="block text-sm font-medium text-[#374151] mb-1">
                비밀번호 확인
              </label>
              <input
                id="signup-password-confirm"
                type="password"
                value={signupPasswordConfirm}
                onChange={e => setSignupPasswordConfirm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#34D399] focus:border-transparent"
                placeholder="비밀번호를 다시 입력하세요"
                required
              />
            </div>
            <div>
              <label htmlFor="signup-displayname" className="block text-sm font-medium text-[#374151] mb-1">
                표시 이름
              </label>
              <input
                id="signup-displayname"
                type="text"
                value={signupDisplayName}
                onChange={e => setSignupDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#34D399] focus:border-transparent"
                placeholder="다른 사용자에게 보여질 이름"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#34D399] hover:bg-[#6EE7B7] text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? '가입 중...' : '가입하기'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
