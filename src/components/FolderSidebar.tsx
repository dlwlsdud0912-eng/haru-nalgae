'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Folder {
  id: string;
  name: string;
  color: string;
  role?: string;
}

interface FolderSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
}

const PRESET_COLORS = [
  '#34D399', '#FCD34D', '#F87171', '#60A5FA',
  '#A78BFA', '#FB923C', '#F472B6', '#94A3B8',
];

export default function FolderSidebar({
  isOpen,
  onClose,
  selectedFolderId,
  onSelectFolder,
}: FolderSidebarProps) {
  const router = useRouter();
  const [myFolders, setMyFolders] = useState<Folder[]>([]);
  const [sharedFolders, setSharedFolders] = useState<Folder[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const fetchFolders = useCallback(() => {
    fetch('/api/folders', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setMyFolders(data.data?.myFolders ?? []);
          setSharedFolders(data.data?.sharedFolders ?? []);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) fetchFolders();
  }, [isOpen, fetchFolders]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      const data = await res.json();
      if (data.success) {
        setNewName('');
        setShowNewForm(false);
        fetchFolders();
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-[#D1FAE5] z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-[#D1FAE5]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🕊️</span>
            <span className="font-bold text-[#1F2937]">하루날개</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {/* My Folders */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider px-2 mb-2">
              📂 내 폴더
            </p>
            <button
              onClick={() => onSelectFolder(null)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                selectedFolderId === null
                  ? 'bg-[#D1FAE5] text-[#1F2937]'
                  : 'text-[#1F2937] hover:bg-[#F0FDF4]'
              }`}
            >
              📋 전체 일정
            </button>
            {myFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onSelectFolder(folder.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedFolderId === folder.id
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
            ))}
          </div>

          {/* Shared Folders */}
          {sharedFolders.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider px-2 mb-2">
                공유받은 폴더
              </p>
              {sharedFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => onSelectFolder(folder.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                    selectedFolderId === folder.id
                      ? 'bg-[#D1FAE5] text-[#1F2937]'
                      : 'text-[#1F2937] hover:bg-[#F0FDF4]'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: folder.color }}
                  />
                  <span className="flex-1 truncate">{folder.name}</span>
                  <span className="text-[10px] bg-[#F0FDF4] text-[#64748B] px-1.5 py-0.5 rounded-md">
                    {folder.role === 'editor' ? '편집자' : '뷰어'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* New Folder Form */}
          {showNewForm && (
            <div className="px-2 mb-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="폴더 이름"
                className="w-full border border-[#D1FAE5] rounded-xl px-3 py-2 text-sm mb-2 outline-none focus:border-[#34D399] transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      newColor === c ? 'scale-125 ring-2 ring-offset-1 ring-[#34D399]' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="flex-1 bg-[#34D399] text-white text-sm py-1.5 rounded-xl disabled:opacity-50 transition-colors hover:bg-[#6EE7B7]"
                >
                  {creating ? '생성 중...' : '추가'}
                </button>
                <button
                  onClick={() => {
                    setShowNewForm(false);
                    setNewName('');
                  }}
                  className="flex-1 bg-[#F0FDF4] text-[#64748B] text-sm py-1.5 rounded-xl hover:bg-[#D1FAE5] transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="border-t border-[#D1FAE5] px-3 py-3 space-y-1">
          {!showNewForm && (
            <button
              onClick={() => setShowNewForm(true)}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#34D399] hover:bg-[#F0FDF4] transition-colors"
            >
              + 새 폴더
            </button>
          )}
          <button
            onClick={() => {
              onClose();
              router.push('/settings');
            }}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#64748B] hover:bg-[#F0FDF4] transition-colors"
          >
            ⚙ 설정
          </button>
        </div>
      </div>
    </>
  );
}
