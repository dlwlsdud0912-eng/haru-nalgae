'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { getKoreanHolidays } from '@/lib/holidays';

// ── Types ──
interface CalendarViewProps {
  selectedFolderId: string | null;
  onMenuClick: () => void;
  refreshTrigger?: number;
}

interface CalendarEvent {
  id: string;
  folder_id: string;
  title: string;
  event_date: string;
  event_time?: string;
  event_type: string;
  amount?: number;
  memo?: string;
  completed?: boolean;
  created_at: string;
  updated_at: string;
}

interface EventCategory {
  id: string;
  name: string;
  colorBg: string;
  colorText: string;
  sortOrder: number;
  isDefault: boolean;
  keywords: string;
}

// ── Fallback color mapping ──
function getEventTypeColorFallback(eventType: string): { bg: string; text: string } {
  if (eventType === '계약') return { bg: '#dbeafe', text: '#1e3a8a' };
  if (eventType.startsWith('중도금')) return { bg: '#fef3c7', text: '#78350f' };
  if (eventType === '잔금') return { bg: '#dcfce7', text: '#14532d' };
  if (eventType === '안내') return { bg: '#f3e8ff', text: '#581c87' };
  if (eventType === '상담') return { bg: '#fce7f3', text: '#831843' };
  return { bg: '#f3f4f6', text: '#374151' };
}

// ── Color presets for category manager ──
const COLOR_PRESETS: { bg: string; text: string }[] = [
  { bg: '#3b82f6', text: '#ffffff' },
  { bg: '#ef4444', text: '#ffffff' },
  { bg: '#22c55e', text: '#ffffff' },
  { bg: '#f59e0b', text: '#ffffff' },
  { bg: '#8b5cf6', text: '#ffffff' },
  { bg: '#ec4899', text: '#ffffff' },
  { bg: '#06b6d4', text: '#ffffff' },
  { bg: '#f97316', text: '#ffffff' },
  { bg: '#6366f1', text: '#ffffff' },
  { bg: '#14b8a6', text: '#ffffff' },
  { bg: '#e11d48', text: '#ffffff' },
  { bg: '#84cc16', text: '#1a2e05' },
  { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#fee2e2', text: '#991b1b' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#f3e8ff', text: '#6b21a8' },
  { bg: '#f3f4f6', text: '#374151' },
];

// ── Detect event type from title ──
function detectEventType(title: string, categories: EventCategory[]): string {
  // Check category keywords first
  for (const cat of categories) {
    if (!cat.keywords) continue;
    const kwList = cat.keywords.split(',').map(k => k.trim()).filter(Boolean);
    if (kwList.some(kw => title.includes(kw))) {
      return cat.name;
    }
  }
  // Fallback
  if (title.includes('계약')) return '계약';
  if (title.includes('중도금')) return '중도금1차';
  if (title.includes('잔금')) return '잔금';
  if (title.includes('안내') || title.includes('견학') || title.includes('방문')) return '안내';
  if (title.includes('상담')) return '상담';
  return '일상';
}

// ── Amount formatting ──
function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    const eok = Math.floor(amount / 100000000);
    const man = Math.floor((amount % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man}만원` : `${eok}억원`;
  }
  if (amount >= 10000) {
    return `${Math.floor(amount / 10000)}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

// ── Format event time ──
function formatEventTime(time: string): string {
  const [h, m] = time.split(':');
  const hh = String(parseInt(h)).padStart(2, '0');
  if (m === '00') return `${hh}시`;
  return `${hh}:${m.padStart(2, '0')}`;
}

// ── Extract time from event ──
function extractEventHour(event: CalendarEvent): number | null {
  if (event.event_time) {
    const h = parseInt(event.event_time.split(':')[0], 10);
    if (!isNaN(h)) return h;
  }
  const match = event.title.match(/(\d{1,2})시/);
  if (match) {
    const h = parseInt(match[1], 10);
    if (h >= 0 && h <= 23) return h;
  }
  return null;
}

// ── Sort events by time ──
function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const aTime = a.event_time || null;
    const bTime = b.event_time || null;
    if (aTime && bTime) return aTime.localeCompare(bTime);
    const aHour = extractEventHour(a);
    const bHour = extractEventHour(b);
    if (aHour !== null && bHour !== null) {
      if (aHour !== bHour) return aHour - bHour;
      if (aTime && !bTime) return -1;
      if (!aTime && bTime) return 1;
      return 0;
    }
    if (aHour !== null) return -1;
    if (bHour !== null) return 1;
    return 0;
  });
}

// ── Calendar helpers ──
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

// ── Theme colors (mint + cream) ──
const THEME = {
  bg: '#FFFDF7',
  accent: '#34D399',
  accentHover: '#6EE7B7',
  surface: '#F0FDF4',
  border: '#D1FAE5',
  text: '#1F2937',
  subtext: '#64748B',
} as const;

export default function CalendarView({ selectedFolderId, onMenuClick, refreshTrigger }: CalendarViewProps) {
  // ── State ──
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // ── Categories ──
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catEditName, setCatEditName] = useState('');
  const [catEditBg, setCatEditBg] = useState('#f3f4f6');
  const [catEditText, setCatEditText] = useState('#374151');
  const [addingNewCategory, setAddingNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatBg, setNewCatBg] = useState('#f3f4f6');
  const [newCatText, setNewCatText] = useState('#374151');
  const [catEditKeywords, setCatEditKeywords] = useState('');
  const [newCatKeywords, setNewCatKeywords] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // ── ICS Import ──
  const [showIcsImport, setShowIcsImport] = useState(false);
  const [icsImporting, setIcsImporting] = useState(false);
  const [icsFile, setIcsFile] = useState<File | null>(null);
  const [icsResult, setIcsResult] = useState<{ imported: number; skipped: number; total: number; batchId?: string } | null>(null);
  const [icsError, setIcsError] = useState<string | null>(null);
  const [icsUndoing, setIcsUndoing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [panelDate, setPanelDate] = useState<string | null>(null);
  const [textSize, setTextSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('calendarTextSize');
        if (saved !== null) {
          const val = parseInt(saved, 10);
          if (val === 0 || val === 1 || val === 2) return val;
        }
      } catch { /* ignore */ }
    }
    return 0;
  });

  const toggleTextSize = () => {
    setTextSize(prev => {
      const next = (prev + 1) % 3;
      try { localStorage.setItem('calendarTextSize', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // AI input
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');

  // AI delete confirmation
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  // Edit form
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editEventType, setEditEventType] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editTime, setEditTime] = useState('');

  // Floating AI panel
  const [showAiPanel, setShowAiPanel] = useState(false);

  // AI button drag position
  const [aiBtnPos, setAiBtnPos] = useState<{right: number, bottom: number}>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aiBtnPos');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return { right: 20, bottom: 180 };
  });
  const aiBtnDragRef = useRef<{startX: number, startY: number, origRight: number, origBottom: number, moved: boolean} | null>(null);
  const aiBtnRef = useRef<HTMLButtonElement>(null);

  // AI input ref
  const aiInputRef = useRef<HTMLInputElement>(null);

  // Wheel debounce ref
  const lastWheelTime = useRef<number>(0);

  // ── Swipe slider state/refs ──
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeDirection = useRef<'horizontal' | 'vertical' | null>(null);
  const swipeStartTime = useRef(0);

  // ── Events cache ──
  const eventsCacheRef = useRef<Record<string, CalendarEvent[]>>({});

  // ── Vertical swipe tracking for bottom sheet ──
  const lastSwipeTouchY = useRef<number | null>(null);

  // ── Swipe-to-close refs ──
  const touchStartYRef = useRef<number | null>(null);
  const touchCurrentYRef = useRef<number | null>(null);

  // ── Fetch categories ──
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/categories', { credentials: 'include' });
      const json = await res.json();
      if (json.success && json.data) {
        setCategories(json.data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          name: row.name as string,
          colorBg: row.color_bg as string,
          colorText: row.color_text as string,
          sortOrder: row.sort_order as number,
          isDefault: row.is_default as boolean,
          keywords: (row.keywords as string) || '',
        })));
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ── Get category color ──
  const getCategoryColor = useCallback((eventType: string): { bg: string; text: string } => {
    const cat = categories.find(c => c.name === eventType);
    if (cat) return { bg: cat.colorBg, text: cat.colorText };
    return getEventTypeColorFallback(eventType);
  }, [categories]);

  // ── Fetch events ──
  const fetchEvents = useCallback(async (forceRefresh = false, silent = false) => {
    const folderStr = selectedFolderId || 'all';
    const cacheKey = `folder-${folderStr}-${currentYear}-${currentMonth}`;

    if (forceRefresh) {
      delete eventsCacheRef.current[cacheKey];
    }

    if (!forceRefresh && eventsCacheRef.current[cacheKey]) {
      setEvents(eventsCacheRef.current[cacheKey]);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('year', String(currentYear));
      params.set('month', String(currentMonth));
      if (selectedFolderId) {
        params.set('folderId', selectedFolderId);
      }

      const res = await fetch(`/api/calendar/events?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        eventsCacheRef.current[cacheKey] = json.data;
        setEvents(json.data);

        // Prefetch adjacent months
        const pm = currentMonth === 1 ? 12 : currentMonth - 1;
        const py = currentMonth === 1 ? currentYear - 1 : currentYear;
        const nm = currentMonth === 12 ? 1 : currentMonth + 1;
        const ny = currentMonth === 12 ? currentYear + 1 : currentYear;
        const prevKey = `folder-${folderStr}-${py}-${pm}`;
        const nextKey = `folder-${folderStr}-${ny}-${nm}`;
        if (!eventsCacheRef.current[prevKey]) {
          const pp = new URLSearchParams();
          pp.set('year', String(py));
          pp.set('month', String(pm));
          if (selectedFolderId) pp.set('folderId', selectedFolderId);
          fetch(`/api/calendar/events?${pp}`, { credentials: 'include' })
            .then(r => r.json())
            .then(j => { if (j.success) eventsCacheRef.current[prevKey] = j.data; })
            .catch(() => {});
        }
        if (!eventsCacheRef.current[nextKey]) {
          const np = new URLSearchParams();
          np.set('year', String(ny));
          np.set('month', String(nm));
          if (selectedFolderId) np.set('folderId', selectedFolderId);
          fetch(`/api/calendar/events?${np}`, { credentials: 'include' })
            .then(r => r.json())
            .then(j => { if (j.success) eventsCacheRef.current[nextKey] = j.data; })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentYear, currentMonth, selectedFolderId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // refreshTrigger
  useEffect(() => {
    if (refreshTrigger === undefined) return;
    eventsCacheRef.current = {};
    fetchEvents(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // ── Panel animation timing ──
  useEffect(() => {
    if (selectedDate) {
      setPanelDate(selectedDate);
    } else {
      const timer = setTimeout(() => setPanelDate(null), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedDate]);

  // ── Month navigation ──
  const changeMonth = (delta: number) => {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setCurrentYear(newYear);
    setCurrentMonth(newMonth);
    setShowAddForm(false);
    setEditingEvent(null);
    setShowMonthPicker(false);
  };

  // ── Swipe handlers ──
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    if (isSnapping) return;
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    swipeDirection.current = null;
    swipeStartTime.current = Date.now();
  }, [isSnapping]);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    if (swipeStartX.current === null || swipeStartY.current === null || isSnapping) return;

    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = e.touches[0].clientY - swipeStartY.current;

    if (!swipeDirection.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      swipeDirection.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }

    if (swipeDirection.current === 'horizontal') {
      e.preventDefault();
      setSwipeOffset(dx);
    }

    if (swipeDirection.current === 'vertical') {
      lastSwipeTouchY.current = e.touches[0].clientY;
    }
  }, [isSnapping]);

  const handleSwipeEnd = useCallback(() => {
    // Vertical swipe → bottom sheet open/close
    if (swipeDirection.current === 'vertical' && swipeStartY.current !== null) {
      const lastY = lastSwipeTouchY.current;
      if (lastY !== null && swipeStartY.current !== null) {
        const verticalDy = lastY - swipeStartY.current;
        if (verticalDy < -50 && !selectedDate) {
          const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
          const todayStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}-${String(kstNow.getDate()).padStart(2, '0')}`;
          setSelectedDate(todayStr);
          setShowAddForm(false);
          setEditingEvent(null);
        } else if (verticalDy > 50 && selectedDate) {
          setSelectedDate(null);
        }
      }
      swipeStartX.current = null;
      swipeStartY.current = null;
      swipeDirection.current = null;
      lastSwipeTouchY.current = null;
      setSwipeOffset(0);
      return;
    }

    if (swipeStartX.current === null || swipeDirection.current !== 'horizontal') {
      swipeStartX.current = null;
      swipeStartY.current = null;
      swipeDirection.current = null;
      lastSwipeTouchY.current = null;
      setSwipeOffset(0);
      return;
    }

    const containerWidth = window.innerWidth;
    const elapsed = Date.now() - swipeStartTime.current;
    const velocity = Math.abs(swipeOffset) / Math.max(elapsed, 1);
    const threshold = velocity > 0.3 ? containerWidth * 0.1 : containerWidth * 0.25;

    if (swipeOffset < -threshold) {
      setIsSnapping(true);
      setSwipeOffset(-containerWidth);
      setTimeout(() => {
        requestAnimationFrame(() => {
          flushSync(() => {
            setIsSnapping(false);
            setSwipeOffset(0);
            changeMonth(1);
          });
        });
      }, 250);
    } else if (swipeOffset > threshold) {
      setIsSnapping(true);
      setSwipeOffset(containerWidth);
      setTimeout(() => {
        requestAnimationFrame(() => {
          flushSync(() => {
            setIsSnapping(false);
            setSwipeOffset(0);
            changeMonth(-1);
          });
        });
      }, 250);
    } else {
      setIsSnapping(true);
      setSwipeOffset(0);
      setTimeout(() => setIsSnapping(false), 250);
    }

    swipeStartX.current = null;
    swipeStartY.current = null;
    swipeDirection.current = null;
    lastSwipeTouchY.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeOffset, selectedDate]);

  // ── Mouse wheel to change month ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 300) return;

    if (e.deltaY > 30) {
      lastWheelTime.current = now;
      changeMonth(1);
    } else if (e.deltaY < -30) {
      lastWheelTime.current = now;
      changeMonth(-1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, currentYear]);

  // ── AI input auto-focus ──
  useEffect(() => {
    if (showAiPanel && aiInputRef.current) {
      setTimeout(() => aiInputRef.current?.focus(), 320);
    }
  }, [showAiPanel]);

  // ── AI submit ──
  const handleAiSubmit = async () => {
    if (!aiInput.trim() || aiLoading) return;
    setAiResult('');
    setAiLoading(true);

    try {
      let allEvents = events;
      try {
        const params = new URLSearchParams();
        if (selectedFolderId) params.set('folderId', selectedFolderId);
        const allRes = await fetch(`/api/calendar/events?${params}`, { credentials: 'include' });
        const allJson = await allRes.json();
        if (allJson.success && allJson.data) {
          allEvents = allJson.data;
        }
      } catch { /* use current month events */ }

      const res = await fetch('/api/calendar/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: aiInput,
          folderId: selectedFolderId || null,
          events: allEvents,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const { action, events: aiEvents, eventIds } = json.data;
        if (action === 'create' && aiEvents) {
          for (const evt of aiEvents) {
            await fetch('/api/calendar/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ folderId: selectedFolderId, ...evt }),
            });
          }
          setAiResult(`${aiEvents.length}건 일정이 추가되었습니다.`);
          setAiInput('');
        } else if (action === 'update' && aiEvents) {
          for (const evt of aiEvents) {
            await fetch('/api/calendar/events', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(evt),
            });
          }
          setAiResult('일정이 수정되었습니다.');
        } else if (action === 'delete' && eventIds) {
          setPendingDeleteIds(eventIds);
          setAiResult('삭제 확인 대기 중...');
        } else if (action === 'query') {
          setAiResult(json.data.message || '답변을 생성하지 못했습니다.');
        } else if (action === 'error') {
          setAiResult(json.data.message || '처리할 수 없습니다.');
        }
        await fetchEvents(true);
      } else {
        setAiResult(json.error || '요청 처리에 실패했습니다.');
      }
    } catch {
      setAiResult('처리 중 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
      setAiInput('');
    }
  };

  // ── Direct add event ──
  const handleDirectAdd = async () => {
    if (!addTitle.trim() || !selectedDate) return;

    const autoEventType = detectEventType(addTitle.trim(), categories);

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          folderId: selectedFolderId || undefined,
          title: addTitle.trim(),
          eventDate: selectedDate,
          eventType: autoEventType,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(`일정 추가 실패: ${json.error}`);
        return;
      }
      setAddTitle('');
      setShowAddForm(false);
      const folderStr = selectedFolderId || 'all';
      delete eventsCacheRef.current[`folder-${folderStr}-${currentYear}-${currentMonth}`];
      await fetchEvents(true, true);
    } catch (err) {
      console.error('Failed to add event:', err);
      alert('일정 추가 중 오류가 발생했습니다.');
    }
  };

  // ── Edit event ──
  const startEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEditTitle(event.title);
    setEditDate(event.event_date);
    setEditEventType(event.event_type);
    setEditAmount(event.amount ? String(event.amount) : '');
    setEditTime(event.event_time || '');
  };

  const handleEditSave = async () => {
    if (!editingEvent || !editTitle.trim()) return;
    try {
      await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: editingEvent.id,
          title: editTitle.trim(),
          eventDate: editDate,
          eventTime: editTime || undefined,
          eventType: editEventType,
          amount: editAmount ? Number(editAmount) : undefined,
        }),
      });
      setEditingEvent(null);
      const folderStr = selectedFolderId || 'all';
      delete eventsCacheRef.current[`folder-${folderStr}-${currentYear}-${currentMonth}`];
      await fetchEvents(true, true);
    } catch (err) {
      console.error('Failed to update event:', err);
    }
  };

  // ── Delete event ──
  const handleDelete = async (id: string) => {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
      await fetch('/api/calendar/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      const folderStr = selectedFolderId || 'all';
      delete eventsCacheRef.current[`folder-${folderStr}-${currentYear}-${currentMonth}`];
      await fetchEvents(true, true);
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  // ── AI delete confirmation ──
  const handleConfirmDelete = async () => {
    try {
      for (const id of pendingDeleteIds) {
        await fetch('/api/calendar/events', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id }),
        });
      }
      setAiResult(`${pendingDeleteIds.length}건 일정이 삭제되었습니다.`);
      setPendingDeleteIds([]);
      const folderStr = selectedFolderId || 'all';
      delete eventsCacheRef.current[`folder-${folderStr}-${currentYear}-${currentMonth}`];
      await fetchEvents(true, true);
    } catch {
      setAiResult('삭제 중 오류가 발생했습니다.');
      setPendingDeleteIds([]);
    }
  };

  const handleCancelDelete = () => {
    setPendingDeleteIds([]);
    setAiResult('삭제가 취소되었습니다.');
  };

  const handleToggleComplete = async (eventId: string, completed: boolean) => {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, completed } : e));
    Object.keys(eventsCacheRef.current).forEach(key => {
      eventsCacheRef.current[key] = eventsCacheRef.current[key].map(e =>
        e.id === eventId ? { ...e, completed } : e
      );
    });
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: eventId, completed }),
      });
      if (!res.ok) {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, completed: !completed } : e));
      }
    } catch {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, completed: !completed } : e));
    }
  };

  // ── Calendar grid data ──
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const todayStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}-${String(kstNow.getDate()).padStart(2, '0')}`;

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const getDateStr = (day: number) =>
    `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const holidays = getKoreanHolidays(currentYear);

  const displayDate = selectedDate || panelDate;
  const selectedDateEvents = displayDate
    ? sortEventsByTime(events.filter((e) => e.event_date === displayDate))
    : [];

  // ── AI button drag handlers (touch) ──
  const handleAiBtnTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    aiBtnDragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      origRight: aiBtnPos.right,
      origBottom: aiBtnPos.bottom,
      moved: false
    };
  }, [aiBtnPos]);

  const handleAiBtnTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (!aiBtnDragRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - aiBtnDragRef.current.startX;
    const dy = touch.clientY - aiBtnDragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      aiBtnDragRef.current.moved = true;
    }
    if (aiBtnDragRef.current.moved && aiBtnRef.current) {
      const newRight = Math.max(5, Math.min(window.innerWidth - 60, aiBtnDragRef.current.origRight - dx));
      const newBottom = Math.max(5, Math.min(window.innerHeight - 60, aiBtnDragRef.current.origBottom - dy));
      aiBtnRef.current.style.right = `${newRight}px`;
      aiBtnRef.current.style.bottom = `${newBottom}px`;
    }
  }, []);

  const handleAiBtnTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!aiBtnDragRef.current) return;
    const wasDrag = aiBtnDragRef.current.moved;
    aiBtnDragRef.current = null;
    if (wasDrag && aiBtnRef.current) {
      const finalRight = parseInt(aiBtnRef.current.style.right) || 20;
      const finalBottom = parseInt(aiBtnRef.current.style.bottom) || 180;
      const newPos = { right: finalRight, bottom: finalBottom };
      setAiBtnPos(newPos);
      localStorage.setItem('aiBtnPos', JSON.stringify(newPos));
    } else {
      setSelectedDate(null);
      setShowAiPanel(true);
    }
  }, []);

  // ── AI button drag handlers (mouse - PC) ──
  const handleAiBtnMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    aiBtnDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origRight: aiBtnPos.right,
      origBottom: aiBtnPos.bottom,
      moved: false
    };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!aiBtnDragRef.current) return;
      const dx = ev.clientX - aiBtnDragRef.current.startX;
      const dy = ev.clientY - aiBtnDragRef.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) aiBtnDragRef.current.moved = true;
      if (aiBtnDragRef.current.moved && aiBtnRef.current) {
        const newRight = Math.max(5, Math.min(window.innerWidth - 60, aiBtnDragRef.current.origRight - dx));
        const newBottom = Math.max(5, Math.min(window.innerHeight - 60, aiBtnDragRef.current.origBottom - dy));
        aiBtnRef.current.style.right = `${newRight}px`;
        aiBtnRef.current.style.bottom = `${newBottom}px`;
      }
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (!aiBtnDragRef.current) return;
      const wasDrag = aiBtnDragRef.current.moved;
      aiBtnDragRef.current = null;
      if (wasDrag && aiBtnRef.current) {
        const finalRight = parseInt(aiBtnRef.current.style.right) || 20;
        const finalBottom = parseInt(aiBtnRef.current.style.bottom) || 180;
        const newPos = { right: finalRight, bottom: finalBottom };
        setAiBtnPos(newPos);
        localStorage.setItem('aiBtnPos', JSON.stringify(newPos));
      } else {
        setSelectedDate(null);
        setShowAiPanel(true);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [aiBtnPos]);

  // ── Prev/Next month helpers ──
  const getPrevMonth = () => {
    if (currentMonth === 1) return { year: currentYear - 1, month: 12 };
    return { year: currentYear, month: currentMonth - 1 };
  };
  const getNextMonth = () => {
    if (currentMonth === 12) return { year: currentYear + 1, month: 1 };
    return { year: currentYear, month: currentMonth + 1 };
  };

  const getCalendarDaysForMonth = (year: number, month: number) => {
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const daysInMth = new Date(year, month, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  const prevMonthData = getPrevMonth();
  const nextMonthData = getNextMonth();
  const prevCalendarDays = getCalendarDaysForMonth(prevMonthData.year, prevMonthData.month);
  const nextCalendarDays = getCalendarDaysForMonth(nextMonthData.year, nextMonthData.month);
  const prevHolidays = getKoreanHolidays(prevMonthData.year);
  const nextHolidays = getKoreanHolidays(nextMonthData.year);

  const folderStr = selectedFolderId || 'all';

  // ── Render day cell ──
  const renderDayCell = (day: number | null, idx: number, year: number, month: number, holidayMap: Map<string, string>, isOtherMonth: boolean, cellEvents?: CalendarEvent[]) => {
    if (day === null) {
      return <div key={`empty-${year}-${month}-${idx}`} className="" />;
    }

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEventsForCell = sortEventsByTime((cellEvents ?? events).filter(e => e.event_date === dateStr));
    const isToday = dateStr === todayStr;
    const isSelected = !isOtherMonth && dateStr === selectedDate;
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;
    const holidayName = holidayMap.get(dateStr);
    const isHoliday = !!holidayName;
    const maxVisible = textSize === 2 ? 3 : textSize === 1 ? 5 : 8;

    return (
      <div
        key={dateStr}
        onClick={isOtherMonth ? undefined : (e) => {
          e.stopPropagation();
          setSelectedDate(selectedDate === dateStr ? null : dateStr);
          setShowAddForm(false);
          setEditingEvent(null);
        }}
        className={`p-px sm:p-1 ${isOtherMonth ? '' : 'cursor-pointer active:scale-[0.95]'} transition-all duration-100 overflow-hidden ${
          isSelected ? 'bg-[#D1FAE5]/30' : !isOtherMonth ? 'hover:bg-[#F0FDF4]/50' : ''
        }`}
        style={isSelected ? { backgroundColor: `${THEME.border}30` } : undefined}
      >
        <div className={`flex items-center justify-center sm:justify-start ${textSize === 2 ? 'mb-1' : 'mb-0.5'}`}>
          <span className={`${textSize === 2 ? 'text-base sm:text-lg w-8 h-8' : textSize === 1 ? 'text-sm w-7 h-7' : 'text-xs w-6 h-6'} inline-flex items-center justify-center rounded-full ${
            isToday ? 'text-white font-bold' :
            isHoliday || isSunday ? 'text-red-500 font-semibold' :
            isSaturday ? 'text-blue-500 font-semibold' :
            'font-semibold'
          }`} style={isToday ? { backgroundColor: THEME.accent, color: '#fff' } : { color: isHoliday || isSunday ? undefined : isSaturday ? undefined : THEME.text }}>
            {day}
          </span>
        </div>
        {holidayName && (
          <p className={`${textSize === 2 ? 'text-[13px]' : textSize === 1 ? 'text-[9px]' : 'text-[7px]'} text-red-400 leading-tight truncate text-center sm:text-left`}>{holidayName}</p>
        )}
        <div className="space-y-px">
          {dayEventsForCell.slice(0, maxVisible).map((evt) => (
            <div
              key={evt.id}
              className={`${textSize === 2 ? 'text-[15px] py-0.5 pl-1' : textSize === 1 ? 'text-[11px] py-px pl-0.5' : 'text-[9px] py-px pl-0.5'} leading-tight font-semibold overflow-hidden whitespace-nowrap rounded-sm${evt.completed ? ' opacity-40 line-through' : ''}`}
              style={{ textOverflow: 'clip', backgroundColor: getCategoryColor(evt.event_type).bg, color: getCategoryColor(evt.event_type).text }}
              title={`${evt.event_time ? formatEventTime(evt.event_time) + ' ' : ''}${evt.title}${evt.amount ? ' ' + formatAmount(evt.amount) : ''}`}
            >
              {evt.event_time ? <span className={`${textSize === 2 ? 'text-[14px]' : textSize === 1 ? 'text-[10px]' : 'text-[8px]'} font-semibold mr-px`}>{formatEventTime(evt.event_time)}</span> : null}
              {evt.title}
              {evt.amount ? ` ${formatAmount(evt.amount)}` : ''}
            </div>
          ))}
          {dayEventsForCell.length > maxVisible && (
            <div className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[10px]' : 'text-[8px]'} font-medium px-1`} style={{ color: THEME.subtext }}>
              +{dayEventsForCell.length - maxVisible}건
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: THEME.bg }}>
      {/* Title Bar */}
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${THEME.border}` }}>
        <button
          onClick={onMenuClick}
          className="flex items-center gap-1 text-sm transition-colors px-2 py-1 rounded-lg hover:bg-[#F0FDF4]"
          style={{ color: THEME.subtext }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-bold" style={{ color: THEME.text }}>하루날개 캘린더</span>
        <button
          onClick={toggleTextSize}
          className="px-3.5 py-1.5 text-sm font-bold rounded-full transition-all duration-150 active:scale-[0.92]"
          style={textSize > 0
            ? { backgroundColor: THEME.accent, color: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
            : { backgroundColor: THEME.surface, color: THEME.accent, border: `1px solid ${THEME.border}` }
          }
          title={textSize === 0 ? '크게보기' : textSize === 1 ? '더크게보기' : '기본보기'}
        >
          {textSize === 0 ? '크게' : textSize === 1 ? '더크게' : '기본'}
        </button>
      </div>

      {/* Calendar content */}
      <div className="flex-1 flex flex-col overflow-hidden" onClick={() => { if (selectedDate) setSelectedDate(null); }}>
        {/* Month Navigation */}
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 flex-shrink-0" style={{ borderBottom: `1px solid ${THEME.border}` }}>
          <button
            onClick={() => changeMonth(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
            style={{ color: THEME.subtext }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            className="text-lg font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer hover:bg-[#F0FDF4]"
            style={{ color: THEME.text }}
          >
            {currentYear}년 {String(currentMonth).padStart(2, '0')}월
            <svg className="w-3.5 h-3.5 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: THEME.subtext }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showMonthPicker ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
            </svg>
          </button>
          <button
            onClick={() => {
              const now = new Date();
              setCurrentYear(now.getFullYear());
              setCurrentMonth(now.getMonth() + 1);
              setSelectedDate(null);
              setShowAddForm(false);
              setEditingEvent(null);
              setShowMonthPicker(false);
            }}
            className="text-xs font-medium px-2 py-1 rounded-md transition-colors"
            style={{ color: THEME.subtext, border: `1px solid ${THEME.border}` }}
          >
            오늘
          </button>
          <button
            onClick={() => changeMonth(1)}
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
            style={{ color: THEME.subtext }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Year/Month Picker */}
        {showMonthPicker && (
          <div className="px-4 py-3 animate-[slideDown_200ms_cubic-bezier(0.34,1.56,0.64,1)]" style={{ borderBottom: `1px solid ${THEME.border}`, backgroundColor: THEME.surface }}>
            <div className="flex items-center justify-center gap-3 mb-3">
              <button onClick={() => setCurrentYear(currentYear - 1)} className="p-1 hover:bg-white/50 rounded-md transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: THEME.subtext }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-bold min-w-[60px] text-center" style={{ color: THEME.text }}>{currentYear}년</span>
              <button onClick={() => setCurrentYear(currentYear + 1)} className="p-1 hover:bg-white/50 rounded-md transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: THEME.subtext }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setCurrentMonth(m);
                    setSelectedDate(null);
                    setShowAddForm(false);
                    setEditingEvent(null);
                    setShowMonthPicker(false);
                  }}
                  className="py-1.5 text-sm rounded-md transition-all duration-150 active:scale-[0.92]"
                  style={
                    m === currentMonth
                      ? { backgroundColor: THEME.accent, color: '#fff', fontWeight: 700 }
                      : m === new Date().getMonth() + 1 && currentYear === new Date().getFullYear()
                        ? { color: THEME.accent, fontWeight: 600 }
                        : { color: THEME.text }
                  }
                >
                  {m}월
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ICS Import + Category Manager buttons */}
        <div className="flex items-center gap-3 px-4 py-1" style={{ borderBottom: `1px solid ${THEME.border}`, backgroundColor: THEME.surface }}>
          <span className="flex-1" />
          <button
            onClick={() => {
              setShowIcsImport(true);
              setIcsFile(null);
              setIcsResult(null);
              setIcsError(null);
            }}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px] sm:text-[15px]' : 'text-[11px] sm:text-[13px]'} font-bold rounded-full transition-all duration-200 active:scale-[0.92] shadow-sm whitespace-nowrap`}
            style={{ color: THEME.accent, backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}
          >
            <span>가져오기</span>
          </button>
          <button
            onClick={() => {
              setShowCategoryManager(true);
              setEditingCategoryId(null);
              setAddingNewCategory(false);
            }}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px] sm:text-[15px]' : 'text-[11px] sm:text-[13px]'} font-bold rounded-full transition-all duration-200 active:scale-[0.92] shadow-sm whitespace-nowrap`}
            style={{ color: THEME.accent, backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}
          >
            <span>컬러태그</span>
          </button>
        </div>

        {/* Weekday Header */}
        <div className={`grid grid-cols-7 text-center ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} font-bold`} style={{ color: THEME.text, borderBottom: `1px solid ${THEME.border}` }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <div
              key={d}
              className={`py-1 ${d === '일' ? 'text-red-500' : d === '토' ? 'text-blue-500' : ''}`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid - 3-panel swipe slider */}
        <div className="relative flex-1 overflow-hidden" onWheel={handleWheel}>
          {loading && (
            <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden z-10" style={{ backgroundColor: THEME.border }}>
              <div className="h-full rounded-full animate-pulse" style={{ width: '40%', backgroundColor: THEME.accent }} />
            </div>
          )}
          <div
            className={`flex h-full will-change-transform ${isSnapping ? 'transition-transform duration-[250ms] ease-[cubic-bezier(0.25,1,0.5,1)]' : ''}`}
            style={{
              width: '300%',
              transform: `translateX(calc(-33.333% + ${swipeOffset}px))`,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            onTouchStart={handleSwipeStart}
            onTouchMove={handleSwipeMove}
            onTouchEnd={handleSwipeEnd}
          >
            {/* Previous month */}
            <div className="w-1/3 h-full">
              <div className="grid grid-cols-7 h-full auto-rows-fr">
                {prevCalendarDays.map((day, idx) => renderDayCell(day, idx, prevMonthData.year, prevMonthData.month, prevHolidays, true, eventsCacheRef.current[`folder-${folderStr}-${prevMonthData.year}-${prevMonthData.month}`] || []))}
              </div>
            </div>
            {/* Current month */}
            <div className="w-1/3 h-full">
              <div className={`grid grid-cols-7 h-full auto-rows-fr ${loading ? 'pointer-events-none' : ''}`} onClick={() => { setSelectedDate(null); setShowAddForm(false); setEditingEvent(null); }}>
                {calendarDays.map((day, idx) => renderDayCell(day, idx, currentYear, currentMonth, holidays, false))}
              </div>
            </div>
            {/* Next month */}
            <div className="w-1/3 h-full">
              <div className="grid grid-cols-7 h-full auto-rows-fr">
                {nextCalendarDays.map((day, idx) => renderDayCell(day, idx, nextMonthData.year, nextMonthData.month, nextHolidays, true, eventsCacheRef.current[`folder-${folderStr}-${nextMonthData.year}-${nextMonthData.month}`] || []))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Date Detail Panel - Bottom Sheet */}
      <div
        className="flex flex-col overflow-hidden shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
        style={{
          backgroundColor: '#fff',
          borderTop: `1px solid ${THEME.border}`,
          height: selectedDate ? '35%' : '0',
          maxHeight: selectedDate ? '35%' : '0',
          overflow: 'hidden',
          transition: selectedDate
            ? 'height 350ms cubic-bezier(0.32, 0.72, 0, 1), max-height 350ms cubic-bezier(0.32, 0.72, 0, 1)'
            : 'height 250ms cubic-bezier(0.4, 0, 0.2, 1), max-height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'height, max-height',
        }}
      >
        <div
          style={{
            opacity: selectedDate ? 1 : 0,
            transform: selectedDate ? 'translateY(0)' : 'translateY(10px)',
            transition: selectedDate
              ? 'opacity 300ms ease 80ms, transform 300ms ease 80ms'
              : 'opacity 150ms ease, transform 150ms ease',
          }}
        >
          <div
            className="flex flex-col items-center pt-3 pb-2 cursor-pointer select-none"
            onClick={() => setSelectedDate(null)}
            onTouchStart={(e) => { touchStartYRef.current = e.touches[0].clientY; touchCurrentYRef.current = e.touches[0].clientY; }}
            onTouchMove={(e) => { touchCurrentYRef.current = e.touches[0].clientY; }}
            onTouchEnd={() => {
              if (touchStartYRef.current !== null && touchCurrentYRef.current !== null && touchCurrentYRef.current - touchStartYRef.current > 50) {
                setSelectedDate(null);
              }
              touchStartYRef.current = null;
              touchCurrentYRef.current = null;
            }}
          >
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: THEME.border }} />
            <span className={`${textSize === 2 ? 'text-xs' : textSize === 1 ? 'text-[11px]' : 'text-[10px]'} mt-1.5`} style={{ color: THEME.subtext }}>터치하면 내려갑니다</span>
          </div>
          {panelDate && (
            <div className="px-4 pb-8 flex-1 overflow-y-auto min-h-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className={`${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} font-bold`} style={{ color: THEME.text }}>일정</h3>
                  {panelDate && holidays.get(panelDate) && (
                    <span className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[14px]' : 'text-xs'} font-semibold text-red-500`}>{holidays.get(panelDate)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowAddForm(true);
                      setEditingEvent(null);
                    }}
                    className={`${textSize === 2 ? 'px-4 py-1.5 text-sm' : textSize === 1 ? 'px-3.5 py-1 text-[14px]' : 'px-3 py-1 text-xs'} font-bold rounded-full transition-all active:scale-[0.92]`}
                    style={{ color: THEME.accent, backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* Simplified Add Form */}
              {showAddForm && (
                <div className="mb-2 p-3 rounded-lg space-y-2" style={{ backgroundColor: THEME.surface }}>
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      placeholder="일정 내용을 입력하세요"
                      rows={1}
                      className={`flex-1 px-3 py-2 ${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} bg-white rounded-lg focus:outline-none focus:ring-2 resize-none`}
                      style={{ border: `1px solid ${THEME.border}`, color: THEME.text, boxShadow: `0 0 0 0px ${THEME.accent}30` }}
                      onFocus={(e) => { (e.target as HTMLTextAreaElement).style.boxShadow = `0 0 0 2px ${THEME.accent}30`; }}
                      onBlur={(e) => { (e.target as HTMLTextAreaElement).style.boxShadow = 'none'; }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (addTitle.trim()) handleDirectAdd();
                        }
                      }}
                    />
                    <button
                      onClick={handleDirectAdd}
                      disabled={!addTitle.trim()}
                      className={`px-4 py-2 ${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex-shrink-0`}
                      style={{ backgroundColor: THEME.accent }}
                    >
                      등록
                    </button>
                  </div>
                </div>
              )}

              {/* Event list */}
              <>
                {selectedDateEvents.length === 0 && !showAddForm && (
                  <p className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[14px]' : 'text-xs'} py-2`} style={{ color: THEME.subtext }}>이 날짜에 일정이 없습니다.</p>
                )}

                {selectedDateEvents.map((event) =>
                  editingEvent?.id === event.id ? (
                    /* Inline Edit Form */
                    <div key={event.id} className="flex flex-col gap-2 py-2 border-b border-[#f0f0f0] last:border-0">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="제목"
                          className={`flex-1 px-2 py-1.5 ${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} rounded-md focus:outline-none focus:ring-1`}
                          style={{ border: `1px solid ${THEME.border}`, color: THEME.text }}
                        />
                        <select
                          value={editEventType}
                          onChange={(e) => setEditEventType(e.target.value)}
                          className={`px-2 py-1.5 ${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} rounded-md focus:outline-none focus:ring-1`}
                          style={{ border: `1px solid ${THEME.border}`, color: THEME.text }}
                        >
                          {(categories.length > 0 ? categories.map(c => c.name) : ['계약', '중도금', '잔금', '안내', '상담', '일상']).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingEvent(null)}
                          className={`px-3 py-1 ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[14px]' : 'text-xs'} rounded-md transition-colors`}
                          style={{ color: THEME.subtext, backgroundColor: THEME.surface }}
                        >
                          취소
                        </button>
                        <button
                          onClick={handleEditSave}
                          className={`px-3 py-1 ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[14px]' : 'text-xs'} text-white rounded-md transition-colors`}
                          style={{ backgroundColor: THEME.accent }}
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Event Row */
                    <div
                      key={event.id}
                      className={`flex gap-2 py-2.5 border-b border-[#f0f0f0] last:border-0 transition-opacity ${event.completed ? 'opacity-40' : ''}`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleComplete(event.id, !event.completed); }}
                        className={`${textSize === 2 ? 'w-6 h-6' : textSize === 1 ? 'w-[22px] h-[22px]' : 'w-5 h-5'} rounded border flex-shrink-0 self-start mt-0.5 flex items-center justify-center transition-colors`}
                        style={event.completed
                          ? { backgroundColor: THEME.accent, borderColor: THEME.accent, color: '#fff' }
                          : { borderColor: '#d1d5db' }
                        }
                      >
                        {event.completed && (
                          <svg className={`${textSize === 2 ? 'w-4 h-4' : textSize === 1 ? 'w-[15px] h-[15px]' : 'w-3.5 h-3.5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      {/* Content area */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5">
                          <span
                            className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[14px]' : 'text-xs'} font-semibold px-1.5 py-0.5 rounded flex-shrink-0`}
                            style={{ backgroundColor: getCategoryColor(event.event_type).bg, color: getCategoryColor(event.event_type).text }}
                          >
                            {event.event_type}
                          </span>
                          {event.event_time && (
                            <span className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[14px]' : 'text-xs'} font-mono font-medium flex-shrink-0`} style={{ color: event.completed ? '#c0bfbc' : THEME.subtext }}>{formatEventTime(event.event_time)}</span>
                          )}
                          <span className={`${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} font-medium break-words ${event.completed ? 'line-through' : ''}`} style={{ color: event.completed ? '#c0bfbc' : THEME.text }}>{event.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {event.amount && (
                            <span className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[14px]' : 'text-xs'} font-medium ${event.completed ? 'line-through' : ''}`} style={{ color: event.completed ? '#c0bfbc' : THEME.subtext }}>{formatAmount(event.amount)}</span>
                          )}
                          <span className="flex-1" />
                          <button
                            onClick={(e) => { e.stopPropagation(); startEdit(event); }}
                            className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[14px]' : 'text-xs'} flex-shrink-0 transition-colors`}
                            style={{ color: THEME.accent }}
                          >
                            수정
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                            className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[14px]' : 'text-xs'} text-red-400 hover:text-red-500 flex-shrink-0 transition-colors`}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </>
            </div>
          )}
        </div>
      </div>

      {/* ── ICS Import Modal (overlay) ── */}
      {showIcsImport && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowIcsImport(false); setIcsFile(null); setIcsResult(null); setIcsError(null); }} />
          <div className="relative bg-gradient-to-b from-[#F0FDF4] to-white rounded-2xl shadow-2xl w-[90%] max-w-sm max-h-[85vh] flex flex-col overflow-hidden" style={{ border: `1px solid ${THEME.border}` }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${THEME.border}`, background: `linear-gradient(to right, ${THEME.surface}, #fff)` }}>
              <h3 className="text-base font-bold" style={{ color: THEME.accent }}>일정 가져오기</h3>
              <button
                onClick={() => { setShowIcsImport(false); setIcsFile(null); setIcsResult(null); setIcsError(null); }}
                className="w-7 h-7 flex items-center justify-center rounded-full transition-all"
                style={{ color: THEME.subtext }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div className="text-sm space-y-2" style={{ color: THEME.subtext }}>
                <p className="font-medium" style={{ color: THEME.text }}>구글 캘린더, 네이버 캘린더에서 내보낸 .ics 파일을 업로드하세요.</p>
                <div className="rounded-xl px-3 py-2.5 space-y-1.5" style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}` }}>
                  <p className="text-xs"><span className="font-bold" style={{ color: THEME.accent }}>구글:</span> 설정 &rarr; 가져오기/내보내기 &rarr; 내보내기</p>
                  <p className="text-xs"><span className="font-bold" style={{ color: THEME.accent }}>네이버:</span> 환경설정 &rarr; 일정설정 &rarr; 내보내기</p>
                </div>
              </div>
              <div>
                <label className="block w-full cursor-pointer">
                  <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-all duration-200 ${icsFile ? '' : 'hover:bg-[#F0FDF4]'}`} style={{ borderColor: icsFile ? THEME.accent : '#d4d4d8' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: THEME.accent }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {icsFile ? (
                      <span className="text-sm font-medium truncate max-w-[200px]" style={{ color: THEME.accent }}>{icsFile.name}</span>
                    ) : (
                      <span className="text-sm" style={{ color: THEME.subtext }}>.ics 파일 선택</span>
                    )}
                  </div>
                  <input type="file" accept=".ics" className="hidden" onChange={(e) => { const file = e.target.files?.[0] || null; setIcsFile(file); setIcsResult(null); setIcsError(null); }} />
                </label>
              </div>
              {icsResult && (
                <div className="bg-[#dcfce7] rounded-xl px-3 py-2.5 border border-[#bbf7d0]">
                  <p className="text-sm font-bold text-[#166534]">{icsResult.imported}건의 일정을 가져왔습니다!</p>
                  {icsResult.skipped > 0 && <p className="text-xs text-[#15803d] mt-0.5">중복 {icsResult.skipped}건 스킵</p>}
                  {icsResult.batchId && icsResult.imported > 0 && (
                    <button
                      disabled={icsUndoing}
                      onClick={async () => {
                        if (!icsResult.batchId) return;
                        if (!window.confirm(`가져온 일정 ${icsResult.imported}건을 삭제합니다.`)) return;
                        setIcsUndoing(true);
                        try {
                          const res = await fetch(`/api/calendar/import?batchId=${encodeURIComponent(icsResult.batchId)}`, { method: 'DELETE', credentials: 'include' });
                          const json = await res.json();
                          if (json.success) { setIcsResult(null); setIcsFile(null); setIcsError(null); eventsCacheRef.current = {}; await fetchEvents(true); }
                          else { setIcsError(json.error || '취소 실패'); }
                        } catch { setIcsError('가져오기 취소 중 오류가 발생했습니다.'); } finally { setIcsUndoing(false); }
                      }}
                      className={`mt-2 w-full py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${icsUndoing ? 'bg-[#e5e5e5] text-[#a3a3a3] cursor-not-allowed' : 'bg-white text-[#dc2626] border border-[#fca5a5] hover:bg-[#fef2f2] active:scale-[0.97]'}`}
                    >
                      {icsUndoing ? '취소하는 중...' : '가져오기 취소 (되돌리기)'}
                    </button>
                  )}
                </div>
              )}
              {icsError && (
                <div className="bg-[#fee2e2] rounded-xl px-3 py-2.5 border border-[#fecaca]">
                  <p className="text-sm font-medium text-[#991b1b]">{icsError}</p>
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="px-4 py-3" style={{ borderTop: `1px solid ${THEME.border}`, backgroundColor: THEME.surface }}>
              <button
                disabled={!icsFile || icsImporting}
                onClick={async () => {
                  if (!icsFile) return;
                  setIcsImporting(true);
                  setIcsResult(null);
                  setIcsError(null);
                  try {
                    const text = await icsFile.text();
                    const res = await fetch('/api/calendar/import', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ icsText: text, folderId: selectedFolderId || undefined }),
                    });
                    const json = await res.json();
                    if (json.success) { setIcsResult(json.data); eventsCacheRef.current = {}; await fetchEvents(true); }
                    else { setIcsError(json.error || '일정 가져오기 실패'); }
                  } catch { setIcsError('파일을 읽는 중 오류가 발생했습니다.'); } finally { setIcsImporting(false); }
                }}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.97] text-white ${!icsFile || icsImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ backgroundColor: THEME.accent }}
              >
                {icsImporting ? '가져오는 중...' : '가져오기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Manager Modal (overlay) ── */}
      {showCategoryManager && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowCategoryManager(false); setEditingCategoryId(null); setAddingNewCategory(false); }} />
          <div className="relative bg-gradient-to-b from-[#F0FDF4] to-white rounded-2xl shadow-2xl w-[90%] max-w-sm max-h-[85vh] flex flex-col overflow-hidden" style={{ border: `1px solid ${THEME.border}` }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${THEME.border}`, background: `linear-gradient(to right, ${THEME.surface}, #fff)` }}>
              <h3 className="text-base font-bold" style={{ color: THEME.accent }}>컬러태그</h3>
              <button
                onClick={() => { setShowCategoryManager(false); setEditingCategoryId(null); setAddingNewCategory(false); }}
                className="w-7 h-7 flex items-center justify-center rounded-full transition-all"
                style={{ color: THEME.subtext }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {categories.map((cat) => (
                <div key={cat.id}>
                  {editingCategoryId === cat.id ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: THEME.surface, border: `2px solid ${THEME.accent}` }}>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold px-3 py-1 rounded-full inline-block shadow-sm" style={{ backgroundColor: cat.colorBg, color: cat.colorText }}>{cat.name}</span>
                        <p className="text-xs mt-1 ml-0.5" style={{ color: THEME.accent }}>아래에서 편집 중</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setEditingCategoryId(null); }} className="text-xs font-medium" style={{ color: THEME.accent }}>취소</button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group hover:shadow-sm"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = THEME.surface; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                      onClick={() => {
                        setEditingCategoryId(cat.id);
                        setCatEditName(cat.name);
                        setCatEditBg(cat.colorBg);
                        setCatEditText(cat.colorText);
                        setCatEditKeywords(cat.keywords || '');
                        setAddingNewCategory(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold px-3 py-1 rounded-full inline-block shadow-sm" style={{ backgroundColor: cat.colorBg, color: cat.colorText }}>{cat.name}</span>
                        <p className="text-xs mt-1 ml-0.5 truncate" style={{ color: THEME.subtext }}>
                          {cat.keywords ? `키워드: ${cat.keywords}` : '키워드 없음'}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategoryId(cat.id);
                          setCatEditName(cat.name);
                          setCatEditBg(cat.colorBg);
                          setCatEditText(cat.colorText);
                          setCatEditKeywords(cat.keywords || '');
                          setAddingNewCategory(false);
                        }}
                        className="text-xs opacity-0 group-hover:opacity-100 transition-all font-medium"
                        style={{ color: THEME.accent }}
                      >
                        편집
                      </button>
                      {!cat.isDefault && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm(`'${cat.name}' 태그를 삭제하시겠습니까?`)) return;
                            try {
                              await fetch('/api/calendar/categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ id: cat.id }) });
                              await fetchCategories();
                            } catch (err) { console.error('Failed to delete category:', err); }
                          }}
                          className="text-xs text-red-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {categories.length === 0 && !addingNewCategory && (
                <p className="text-sm py-4 text-center" style={{ color: THEME.subtext }}>아직 태그가 없어요!<br/><span className="text-xs" style={{ color: THEME.border }}>아래에서 나만의 태그를 만들어 보세요</span></p>
              )}
            </div>
            {/* Footer */}
            <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${THEME.border}`, background: `linear-gradient(to right, ${THEME.surface}, #fff)` }}>
              {editingCategoryId ? (() => {
                const editCat = categories.find(c => c.id === editingCategoryId);
                if (!editCat) return null;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold" style={{ color: THEME.accent }}>편집:</span>
                      <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: editCat.colorBg, color: editCat.colorText }}>{editCat.name}</span>
                    </div>
                    <input type="text" value={catEditName} onChange={(e) => setCatEditName(e.target.value)} placeholder="태그 이름" className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 bg-white/80" style={{ border: `1px solid ${THEME.border}`, color: THEME.text, outlineColor: THEME.accent }} autoFocus />
                    <div className="grid grid-cols-6 gap-1.5">
                      {COLOR_PRESETS.map((preset, i) => (
                        <button key={i} onClick={() => { setCatEditBg(preset.bg); setCatEditText(preset.text); }} className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center text-[10px] font-bold shadow-sm hover:scale-110 ${catEditBg === preset.bg && catEditText === preset.text ? 'scale-110' : ''}`} style={{ backgroundColor: preset.bg, color: preset.text, borderColor: catEditBg === preset.bg && catEditText === preset.text ? THEME.accent : 'transparent' }}>
                          가
                        </button>
                      ))}
                    </div>
                    <input type="text" value={catEditKeywords} onChange={(e) => setCatEditKeywords(e.target.value)} placeholder="반응 키워드 (쉼표로 구분)" className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 bg-white/80" style={{ border: `1px solid ${THEME.border}`, color: THEME.text }} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingCategoryId(null)} className="px-4 py-1.5 text-xs font-medium bg-white rounded-full transition-all" style={{ color: THEME.accent, border: `1px solid ${THEME.border}` }}>취소</button>
                      <button
                        onClick={async () => {
                          if (!catEditName.trim() || catSaving) return;
                          setCatSaving(true);
                          try {
                            await fetch('/api/calendar/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ id: editCat.id, name: catEditName.trim(), colorBg: catEditBg, colorText: catEditText, keywords: catEditKeywords }) });
                            await fetchCategories();
                            setEditingCategoryId(null);
                          } catch (err) { console.error('Failed to update category:', err); } finally { setCatSaving(false); }
                        }}
                        disabled={catSaving || !catEditName.trim()}
                        className="px-4 py-1.5 text-xs font-bold text-white rounded-full transition-all disabled:opacity-50 shadow-sm"
                        style={{ backgroundColor: THEME.accent }}
                      >
                        {catSaving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                );
              })() : addingNewCategory ? (
                <div className="space-y-2">
                  <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="새 태그 이름" className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 bg-white/80" style={{ border: `1px solid ${THEME.border}`, color: THEME.text }} autoFocus />
                  <div className="grid grid-cols-6 gap-1.5">
                    {COLOR_PRESETS.map((preset, i) => (
                      <button key={i} onClick={() => { setNewCatBg(preset.bg); setNewCatText(preset.text); }} className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center text-[10px] font-bold shadow-sm hover:scale-110 ${newCatBg === preset.bg && newCatText === preset.text ? 'scale-110' : ''}`} style={{ backgroundColor: preset.bg, color: preset.text, borderColor: newCatBg === preset.bg && newCatText === preset.text ? THEME.accent : 'transparent' }}>
                        가
                      </button>
                    ))}
                  </div>
                  <input type="text" value={newCatKeywords} onChange={(e) => setNewCatKeywords(e.target.value)} placeholder="반응 키워드 (쉼표로 구분)" className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 bg-white/80" style={{ border: `1px solid ${THEME.border}`, color: THEME.text }} />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setAddingNewCategory(false); setNewCatName(''); setNewCatKeywords(''); }} className="px-4 py-1.5 text-xs font-medium bg-white rounded-full transition-all" style={{ color: THEME.accent, border: `1px solid ${THEME.border}` }}>취소</button>
                    <button
                      onClick={async () => {
                        if (!newCatName.trim() || catSaving) return;
                        setCatSaving(true);
                        try {
                          await fetch('/api/calendar/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: newCatName.trim(), colorBg: newCatBg, colorText: newCatText, keywords: newCatKeywords }) });
                          await fetchCategories();
                          setAddingNewCategory(false);
                          setNewCatName('');
                          setNewCatKeywords('');
                          setNewCatBg('#f3f4f6');
                          setNewCatText('#374151');
                        } catch (err) { console.error('Failed to create category:', err); } finally { setCatSaving(false); }
                      }}
                      disabled={catSaving || !newCatName.trim()}
                      className="px-4 py-1.5 text-xs font-bold text-white rounded-full transition-all disabled:opacity-50 shadow-sm"
                      style={{ backgroundColor: THEME.accent }}
                    >
                      {catSaving ? '추가 중...' : '추가'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingNewCategory(true); setEditingCategoryId(null); }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold border-2 border-dashed rounded-xl transition-all"
                  style={{ color: THEME.accent, borderColor: THEME.border }}
                >
                  새 태그 만들기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Button (draggable) */}
      <button
        ref={aiBtnRef}
        onTouchStart={handleAiBtnTouchStart}
        onTouchMove={handleAiBtnTouchMove}
        onTouchEnd={handleAiBtnTouchEnd}
        onMouseDown={handleAiBtnMouseDown}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
        className={`fixed w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center z-[99999] select-none transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${showAiPanel ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}`}
        style={{
          right: `${aiBtnPos.right}px`,
          bottom: `${aiBtnPos.bottom}px`,
          touchAction: 'none',
          background: `linear-gradient(135deg, ${THEME.accent}, #10B981)`,
          animation: 'aiPulse 2s ease-in-out infinite',
          willChange: 'transform',
          boxShadow: `0 0 20px ${THEME.accent}66`
        }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      </button>

      {/* Floating AI Panel */}
      {showAiPanel && (
        <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-[12vh] sm:items-center sm:pt-0" style={{ animation: 'aiBackdropIn 300ms ease-out forwards' }}>
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowAiPanel(false)} style={{ animation: 'aiFadeIn 300ms ease-out forwards' }} />
          <div className="relative w-[94%] max-w-lg" style={{ animation: 'aiPanelIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ border: `1px solid ${THEME.border}`, boxShadow: `0 0 40px ${THEME.accent}26, 0 20px 60px rgba(0,0,0,0.12)` }}>
              {/* AI Panel Header */}
              <div className="px-5 py-3.5 flex items-center justify-between relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${THEME.accent} 0%, #10B981 50%, ${THEME.accentHover} 100%)` }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)', backgroundSize: '200% 100%', animation: 'aiHeaderShimmer 2s ease-in-out infinite' }} />
                <span className="text-sm text-white font-semibold flex items-center gap-2">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  날개의답변
                </span>
                <button onClick={() => setShowAiPanel(false)} className="relative z-10 text-white/80 hover:text-white p-2 -mr-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* AI Input */}
              <div className="p-4">
                <div className="flex gap-2">
                  <input
                    ref={aiInputRef}
                    type="text"
                    placeholder="예: '내일 3시 미팅 추가해줘'"
                    className="flex-1 px-4 py-3 text-base rounded-xl focus:outline-none focus:ring-2"
                    style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.border}`, color: THEME.text, boxShadow: `0 0 0 0px ${THEME.accent}30` }}
                    onFocus={(e) => { (e.target as HTMLInputElement).style.boxShadow = `0 0 0 2px ${THEME.accent}30`; }}
                    onBlur={(e) => { (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAiSubmit();
                    }}
                  />
                  <button
                    onClick={handleAiSubmit}
                    disabled={aiLoading || !aiInput.trim()}
                    className="px-4 py-3 text-white rounded-xl disabled:opacity-40 active:scale-[0.92] transition-all duration-150"
                    style={{ backgroundColor: THEME.accent }}
                  >
                    {aiLoading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* AI Delete Confirmation UI */}
                {pendingDeleteIds.length > 0 && (
                  <div className="mt-2 rounded-xl text-sm overflow-hidden shadow-lg border border-red-200">
                    <div className="flex items-center justify-between px-4 py-2 bg-red-500">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-white/90 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[11px] font-bold text-white tracking-wide">삭제할 일정 {pendingDeleteIds.length}건</span>
                      </div>
                    </div>
                    <div className="px-4 py-3 bg-red-50">
                      <div className="space-y-1.5 mb-3">
                        {pendingDeleteIds.map((id) => {
                          const evt = events.find((e) => e.id === id);
                          return (
                            <div key={id} className="flex items-center gap-2 text-xs text-gray-700">
                              <span className="text-red-400">&#x2022;</span>
                              {evt ? (
                                <>
                                  <span className="px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: getCategoryColor(evt.event_type).bg, color: getCategoryColor(evt.event_type).text }}>{evt.event_type}</span>
                                  <span className="text-gray-500 flex-shrink-0">{evt.event_date}</span>
                                  <span className="font-medium truncate">{evt.title}</span>
                                </>
                              ) : (
                                <span className="text-gray-400">알 수 없는 일정 (ID: {id.slice(0, 8)}...)</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={handleCancelDelete} className="px-3 py-1.5 text-xs bg-white border rounded-md transition-colors" style={{ color: THEME.subtext, borderColor: THEME.border }}>취소</button>
                        <button onClick={handleConfirmDelete} className="px-3 py-1.5 text-xs text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors">삭제 확인</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Result Display */}
                {aiResult && pendingDeleteIds.length === 0 && (
                  <div className={`mt-2 rounded-xl text-sm overflow-hidden ${aiResult.length > 30 ? 'shadow-lg' : 'text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg'}`} style={aiResult.length > 30 ? { border: `1px solid ${THEME.border}` } : undefined}>
                    {aiResult.length > 30 ? (
                      <>
                        <div className="flex items-center justify-between px-4 py-2" style={{ background: `linear-gradient(135deg, ${THEME.accent} 0%, #10B981 50%, ${THEME.accentHover} 100%)` }}>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-white/90 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                            <span className="text-[11px] font-bold text-white tracking-wide">날개의답변</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(aiResult);
                                const btn = document.getElementById('ai-copy-btn');
                                if (btn) { btn.textContent = '복사됨'; setTimeout(() => { btn.textContent = '복사'; }, 1500); }
                              }}
                              id="ai-copy-btn"
                              className="text-[10px] text-white/80 hover:text-white transition-colors px-2 py-0.5 rounded-md hover:bg-white/20"
                            >복사</button>
                            <button onClick={() => setAiResult('')} className="text-[10px] text-white/60 hover:text-white transition-colors px-2 py-0.5 rounded-md hover:bg-white/20">닫기</button>
                          </div>
                        </div>
                        <div className="px-4 py-3 max-h-[40vh] overflow-y-auto" style={{ background: `linear-gradient(to bottom, ${THEME.surface}, #fff)` }}>
                          <div className="whitespace-pre-wrap text-[13px] leading-relaxed font-medium" style={{ color: THEME.text }}>{aiResult}</div>
                        </div>
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap">{aiResult}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes aiPulse {
          0%, 100% { box-shadow: 0 0 15px ${THEME.accent}4D; }
          50% { box-shadow: 0 0 30px ${THEME.accent}99, 0 0 60px ${THEME.accent}33; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px) scaleY(0.95); }
          to { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        @keyframes aiBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes aiFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes aiPanelIn {
          0% { opacity: 0; transform: scale(0.85) translateY(20px); }
          60% { opacity: 1; transform: scale(1.02) translateY(-4px); }
          80% { transform: scale(0.99) translateY(1px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes aiHeaderShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
