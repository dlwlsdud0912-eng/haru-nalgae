import Link from 'next/link';

const features = [
  { icon: '🗓️', title: '월별 캘린더', desc: '스와이프로 한 달씩 넘겨보세요' },
  { icon: '🤖', title: 'AI 일정비서', desc: '말로 일정을 추가하고 검색하세요' },
  { icon: '📥', title: '가져오기', desc: '구글/네이버 캘린더를 한번에 이전' },
  { icon: '🏷️', title: '컬러 태그', desc: '나만의 색상으로 일정 분류' },
  { icon: '📂', title: '공유 폴더', desc: '가족, 팀과 함께 일정 공유' },
  { icon: '✅', title: '완료 체크', desc: '한 일은 체크해서 정리하세요' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#FFFDF7]/80 backdrop-blur-md border-b border-[#D1FAE5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🕊️</span>
            <span className="text-lg font-bold text-[#1F2937]">하루날개</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[#64748B] hover:text-[#1F2937] font-medium px-4 py-2 rounded-xl transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/login"
              className="bg-[#34D399] hover:bg-[#6EE7B7] text-white font-semibold px-5 py-2 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md"
            >
              시작하기
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
        <div className="text-7xl mb-8">🕊️</div>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1F2937] mb-4 leading-tight">
          매일의 일상에 날개를 달아주세요
        </h1>
        <p className="text-[#64748B] text-lg mb-10 max-w-md mx-auto">
          AI가 일정을 정리하고, 캘린더가 하루를 안내합니다.
        </p>
        <Link
          href="/login"
          className="inline-block bg-[#34D399] hover:bg-[#6EE7B7] text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
        >
          🌿 무료로 시작하기
        </Link>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border border-[#D1FAE5]/50"
            >
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold text-[#1F2937] mb-2">{f.title}</h3>
              <p className="text-[#64748B] text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D1FAE5] py-8 text-center">
        <p className="text-[#64748B] text-sm">
          하루날개 &copy; 2026 &middot; 매일의 일상에 날개를
        </p>
      </footer>
    </div>
  );
}
