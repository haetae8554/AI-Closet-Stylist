// backend/src/services/CalendarService.js
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

// DB 연결 설정
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

/**
 * 캘린더 일정 불러오기
 * DB의 'calendar' 테이블에서 최신 데이터 1건을 조회하여 반환합니다.
 */
export async function getCalendarEvents() {
  try {
    const res = await pool.query("SELECT data FROM calendar ORDER BY id DESC LIMIT 1");
    
    if (res.rows.length > 0) {
      let eventData = res.rows[0].data;

      // [추가] DB 컬럼 타입이 TEXT인 경우와 JSON/JSONB인 경우 모두 대응
      if (typeof eventData === 'string') {
        try {
            eventData = JSON.parse(eventData);
        } catch (e) {
            console.error("[CalendarService] JSON 파싱 실패, 빈 객체 반환");
            return {};
        }
      }
      return eventData || {};
    } else {
      return {};
    }
  } catch (error) {
    console.error("[CalendarService] DB Read Error:", error);
    return {};
  }
}

/**
 * 캘린더 일정 저장하기
 * @param {Object} events - 예: { "2023-12-23": [{ title: "..." }] }
 */
export async function saveCalendarEvents(events) {
  if (!events) {
    console.warn("[CalendarService] 저장할 이벤트 데이터가 없습니다.");
    return false;
  }

  // [디버깅용 로그] 실제 저장되는 날짜 키들을 확인 (서버 로그에서 22일인지 23일인지 확인 가능)
  const dateKeys = Object.keys(events);
  console.log(`[CalendarService] 일정 저장 시도. 포함된 날짜들: ${dateKeys.join(", ")}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 기존 데이터 삭제 (최신본 하나만 유지)
    await client.query("DELETE FROM calendar");
    
    // 2. 새 데이터 삽입
    // DB가 JSON 타입을 지원하더라도, 안전하게 문자열로 변환하여 저장
    const jsonStr = JSON.stringify(events);
    await client.query("INSERT INTO calendar (data) VALUES ($1)", [jsonStr]);

    await client.query('COMMIT');
    console.log("[CalendarService] 일정 저장 완료");
    return true;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("[CalendarService] DB Save Error:", error);
    throw new Error("일정을 저장하는 데 실패했습니다.");
  } finally {
    client.release();
  }
}