// ── Korean holidays ──
export function getKoreanHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();

  // 양력 고정 공휴일
  holidays.set(`${year}-01-01`, '신정');
  holidays.set(`${year}-03-01`, '삼일절');
  holidays.set(`${year}-05-05`, '어린이날');
  holidays.set(`${year}-06-06`, '현충일');
  holidays.set(`${year}-08-15`, '광복절');
  holidays.set(`${year}-10-03`, '개천절');
  holidays.set(`${year}-10-09`, '한글날');
  holidays.set(`${year}-12-25`, '크리스마스');

  // 음력 기반 공휴일 (연도별 양력 날짜 하드코딩)
  const lunarHolidays: Record<number, { seollal: string[]; chuseok: string[]; buddha: string }> = {
    2024: {
      seollal: ['02-09', '02-10', '02-11', '02-12'],
      chuseok: ['09-16', '09-17', '09-18'],
      buddha: '05-15',
    },
    2025: {
      seollal: ['01-28', '01-29', '01-30'],
      chuseok: ['10-05', '10-06', '10-07', '10-08'],
      buddha: '05-05',
    },
    2026: {
      seollal: ['02-16', '02-17', '02-18'],
      chuseok: ['09-24', '09-25', '09-26'],
      buddha: '05-24',
    },
    2027: {
      seollal: ['02-05', '02-06', '02-07', '02-08'],
      chuseok: ['09-14', '09-15', '09-16'],
      buddha: '05-13',
    },
    2028: {
      seollal: ['01-25', '01-26', '01-27'],
      chuseok: ['10-02', '10-03', '10-04'],
      buddha: '05-02',
    },
    2029: {
      seollal: ['02-12', '02-13', '02-14'],
      chuseok: ['09-21', '09-22', '09-23', '09-24'],
      buddha: '05-20',
    },
    2030: {
      seollal: ['02-02', '02-03', '02-04'],
      chuseok: ['09-11', '09-12', '09-13'],
      buddha: '05-09',
    },
  };

  const yearData = lunarHolidays[year];
  if (yearData) {
    // 설날 연휴
    yearData.seollal.forEach((d, i) => {
      const seollalNames = ['설날 연휴', '설날', '설날 연휴'];
      if (yearData.seollal.length === 4) {
        if (i === 0) holidays.set(`${year}-${d}`, '설날 연휴');
        else if (i === 1) holidays.set(`${year}-${d}`, '설날');
        else if (i === 2) holidays.set(`${year}-${d}`, '설날 연휴');
        else holidays.set(`${year}-${d}`, '대체공휴일');
      } else {
        holidays.set(`${year}-${d}`, seollalNames[i] || '설날 연휴');
      }
    });

    // 추석 연휴
    yearData.chuseok.forEach((d, i) => {
      const chuseokNames = ['추석 연휴', '추석', '추석 연휴'];
      if (yearData.chuseok.length === 4) {
        if (i === 0) holidays.set(`${year}-${d}`, '추석 연휴');
        else if (i === 1) holidays.set(`${year}-${d}`, '추석');
        else if (i === 2) holidays.set(`${year}-${d}`, '추석 연휴');
        else holidays.set(`${year}-${d}`, '대체공휴일');
      } else {
        holidays.set(`${year}-${d}`, chuseokNames[i] || '추석 연휴');
      }
    });

    // 부처님 오신 날
    holidays.set(`${year}-${yearData.buddha}`, '부처님오신날');
  }

  return holidays;
}
