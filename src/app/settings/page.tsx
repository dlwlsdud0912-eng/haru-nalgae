'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UserData {
  id: string;
  username: string;
  displayName: string;
}

interface Folder {
  id: string;
  name: string;
  color: string;
}

interface Member {
  userId: string;
  username: string;
  displayName: string;
  role: string;
}

interface SearchResult {
  id: string;
  username: string;
  displayName: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Folder management
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setUser(data.data);
          setDisplayName(data.data.displayName);
        } else {
          router.push('/login');
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    fetch('/api/folders', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setFolders(data.data?.myFolders ?? []);
        }
      })
      .catch(() => {});
  }, []);

  const loadMembers = useCallback((folderId: string) => {
    fetch(`/api/folders/${folderId}/members`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setMembers(data.data ?? []);
      })
      .catch(() => {});
  }, []);

  const handleSaveProfile = async () => {
    if (!displayName.trim() || saving) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg('저장되었습니다');
        setTimeout(() => setSaveMsg(''), 2000);
      } else {
        setSaveMsg('저장 실패');
      }
    } catch {
      setSaveMsg('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searching) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (data.success) setSearchResults(data.data ?? []);
    } catch {
      /* ignore */
    } finally {
      setSearching(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedFolder) return;
    try {
      const res = await fetch(`/api/folders/${selectedFolder.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, role: 'viewer' }),
      });
      const data = await res.json();
      if (data.success) {
        loadMembers(selectedFolder.id);
        setSearchResults([]);
        setSearchQuery('');
      }
    } catch {
      /* ignore */
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedFolder) return;
    try {
      const res = await fetch(`/api/folders/${selectedFolder.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) loadMembers(selectedFolder.id);
    } catch {
      /* ignore */
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#34D399] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#FFFDF7]/80 backdrop-blur-md border-b border-[#D1FAE5]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push('/app')}
            className="text-[#64748B] hover:text-[#1F2937] transition-colors text-lg"
          >
            ←
          </button>
          <h1 className="text-lg font-bold text-[#1F2937]">설정</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Profile Section */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#D1FAE5]/50">
          <h2 className="text-base font-bold text-[#1F2937] mb-4">프로필</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#64748B] mb-1">아이디</label>
              <div className="border border-[#D1FAE5] rounded-xl px-4 py-3 text-sm text-[#94A3B8] bg-[#F9FAFB]">
                {user.username}
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#64748B] mb-1">표시 이름</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full border border-[#D1FAE5] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#34D399] transition-colors"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={saving || displayName.trim() === user.displayName}
                className="bg-[#34D399] hover:bg-[#6EE7B7] text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              {saveMsg && (
                <span className="text-sm text-[#34D399]">{saveMsg}</span>
              )}
            </div>
          </div>
        </section>

        {/* Shared Folder Management */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#D1FAE5]/50">
          <h2 className="text-base font-bold text-[#1F2937] mb-4">
            공유 폴더 관리
          </h2>

          {/* Folder list */}
          <div className="space-y-1 mb-4">
            {folders.length === 0 ? (
              <p className="text-sm text-[#64748B]">폴더가 없습니다.</p>
            ) : (
              folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => {
                    setSelectedFolder(folder);
                    loadMembers(folder.id);
                    setSearchResults([]);
                    setSearchQuery('');
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                    selectedFolder?.id === folder.id
                      ? 'bg-[#D1FAE5] text-[#1F2937]'
                      : 'text-[#1F2937] hover:bg-[#F0FDF4]'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: folder.color }}
                  />
                  {folder.name}
                </button>
              ))
            )}
          </div>

          {/* Member management for selected folder */}
          {selectedFolder && (
            <div className="border-t border-[#D1FAE5] pt-4">
              <h3 className="text-sm font-semibold text-[#1F2937] mb-3">
                &ldquo;{selectedFolder.name}&rdquo; 멤버
              </h3>

              {/* Current members */}
              <div className="space-y-2 mb-4">
                {members.length === 0 ? (
                  <p className="text-sm text-[#64748B]">멤버가 없습니다.</p>
                ) : (
                  members.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between px-3 py-2 bg-[#F0FDF4] rounded-xl"
                    >
                      <div>
                        <span className="text-sm font-medium text-[#1F2937]">
                          {m.displayName}
                        </span>
                        <span className="text-xs text-[#64748B] ml-2">
                          @{m.username}
                        </span>
                        <span className="text-[10px] bg-white text-[#64748B] px-1.5 py-0.5 rounded-md ml-2">
                          {m.role === 'editor' ? '편집자' : '뷰어'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(m.userId)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        제거
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Search and add member */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="사용자 검색..."
                  className="flex-1 border border-[#D1FAE5] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#34D399] transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="bg-[#34D399] hover:bg-[#6EE7B7] text-white text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  검색
                </button>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1">
                  {searchResults.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between px-3 py-2 bg-white border border-[#D1FAE5] rounded-xl"
                    >
                      <div>
                        <span className="text-sm font-medium text-[#1F2937]">
                          {r.displayName}
                        </span>
                        <span className="text-xs text-[#64748B] ml-2">
                          @{r.username}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAddMember(r.id)}
                        className="text-xs text-[#34D399] hover:text-[#059669] font-medium transition-colors"
                      >
                        추가
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Account Section */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#D1FAE5]/50">
          <h2 className="text-base font-bold text-[#1F2937] mb-4">계정</h2>
          <button
            onClick={handleLogout}
            className="w-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] font-medium py-3 rounded-xl transition-colors"
          >
            로그아웃
          </button>
        </section>
      </div>
    </div>
  );
}
