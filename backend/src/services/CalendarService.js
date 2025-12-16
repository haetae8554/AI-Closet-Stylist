import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

// DB 연결 설정
// (다른 서비스 파일들과 동일한 설정 유지)
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

/**
 * 캘린더 일정 불러오기
 * DB의 'calendar' 테이블에서 최신 데이터 1건을 조회하여 반환합니다.
 * 데이터가 없거나 에러 발생 시 빈 객체 {}를 반환하여 서비스 중단을 방지합니다.
 */
export async function getCalendarEvents() {
  try {
    // 가장 최근에 저장된 데이터 1개만 가져옵니다.
    // (구조상 1개의 행에 모든 일정을 JSON으로 저장하는 방식)
    const res = await pool.query("SELECT data FROM calendar ORDER BY id DESC LIMIT 1");
    
    if (res.rows.length > 0) {
      return res.rows[0].data;
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
 * 프론트엔드에서 받은 전체 이벤트 객체를 DB에 덮어씌웁니다.
 * 트랜잭션을 사용하여 기존 데이터를 안전하게 삭제 후 삽입합니다.
 * * @param {Object} events - 예: { "2024-05-20": [{ title: "..." }] }
 */
export async function saveCalendarEvents(events) {
  // 유효성 검사: events가 없으면 저장하지 않음
  if (!events) {
    console.warn("[CalendarService] 저장할 이벤트 데이터가 없습니다.");
    return false;
  }

  const client = await pool.connect();
  try {
    // 트랜잭션 시작
    await client.query('BEGIN');

    // 기존 데이터가 계속 쌓이는 것을 방지하기 위해 전체 삭제 후 재입력
    // (개인용 캘린더 등 데이터 양이 적을 때 유효한 전략입니다)
    await client.query("DELETE FROM calendar");
    
    // JSON 데이터를 DB에 저장
    // pg 라이브러리가 객체를 받으면 자동으로 변환해주지만, 
    // 명확한 처리를 위해 JSON.stringify 사용 (컬럼이 TEXT 타입일 경우 대비)
    const jsonStr = JSON.stringify(events);
    await client.query("INSERT INTO calendar (data) VALUES ($1)", [jsonStr]);

    await client.query('COMMIT');
    return true;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("[CalendarService] DB Save Error:", error);
    throw new Error("일정을 저장하는 데 실패했습니다.");
  } finally {
    client.release();
  }
}