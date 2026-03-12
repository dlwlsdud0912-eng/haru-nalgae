'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FolderSidebar from '@/components/FolderSidebar';
import CalendarView from '@/components/CalendarView';

interface UserData {
  id: string;
  username: string;
  displayName: string;
}

export default function AppPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUser(data.data);
        else router.push('/login');
      })
      .catch(() => router.push('/login'));
  }, [router]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#34D399] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF7] relative">
      <FolderSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        selectedFolderId={selectedFolderId}
        onSelectFolder={(id) => {
          setSelectedFolderId(id);
          setSidebarOpen(false);
          setRefreshTrigger((r) => r + 1);
        }}
      />
      <CalendarView
        selectedFolderId={selectedFolderId}
        onMenuClick={() => setSidebarOpen(true)}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
}
