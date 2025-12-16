// backend/src/services/CalendarService.js
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

// DB 연결 설정 (server.js와 동일한 Pool 사용)
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

/**
 * 캘린더 일정 불러오기
 * DB의 'calendar' 테이블에서 데이터를 조회합니다.
 * 데이터가 없으면 빈 객체 {} 반환
 */
export const getCalendarEvents = async () => {
  try {
    // 가장 최근에 저장된 데이터 1개만 가져옵니다.
    // (구조상 1개의 행에 모든 일정을 JSON으로 몰아넣는 방식을 유지합니다)
    const res = await pool.query("SELECT data FROM calendar ORDER BY id DESC LIMIT 1");
    
    if (res.rows.length > 0) {
      return res.rows[0].data;
    } else {
      // 데이터가 없으면 빈 객체 반환
      return {};
    }
  } catch (error) {
    console.error("[CalendarService] DB Read Error:", error);
    // DB 연결 실패 등의 경우 빈 객체를 반환하여 서버가 죽지 않도록 함
    return {};
  }
};

/**
 * 캘린더 일정 저장하기
 * @param {Object} events - 프론트엔드에서 보낸 전체 이벤트 객체
 */
export const saveCalendarEvents = async (events) => {
  const client = await pool.connect();
  try {
    // 트랜잭션 시작 (안전한 저장을 위해)
    await client.query('BEGIN');

    // 기존 데이터가 계속 쌓이는 것을 방지하기 위해
    // 1. 기존 데이터를 모두 지우고 (DELETE)
    // 2. 새로운 데이터를 넣습니다 (INSERT)
    // (데이터 양이 많지 않으므로 이 방식이 가장 깔끔합니다)
    await client.query("DELETE FROM calendar");
    
    // JSON 데이터를 DB에 저장 (JSON.stringify 불필요, pg가 자동으로 처리하지만 명시적으로 변환해도 됨)
    await client.query("INSERT INTO calendar (data) VALUES ($1)", [JSON.stringify(events)]);

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("[CalendarService] DB Save Error:", error);
    throw new Error("일정을 저장하는 데 실패했습니다.");
  } finally {
    client.release();
  }
};