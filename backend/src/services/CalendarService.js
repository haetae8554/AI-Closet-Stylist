// backend/src/services/CalendarService.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// __dirname 설정 (ES Module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 데이터 파일 경로: backend/data/calendar.json
const DATA_DIR = path.join(__dirname, "../../data");
const FILE_PATH = path.join(DATA_DIR, "calendar.json");

// 디렉토리가 없으면 생성
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * 캘린더 일정 불러오기
 * 파일이 없으면 빈 객체 {} 반환
 */
export const getCalendarEvents = async () => {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      // 파일이 없으면 초기화 후 빈 객체 리턴
      await fs.promises.writeFile(FILE_PATH, "{}", "utf8");
      return {};
    }
    const data = await fs.promises.readFile(FILE_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("[CalendarService] Read Error:", error);
    throw new Error("일정을 불러오는 데 실패했습니다.");
  }
};

/**
 * 캘린더 일정 저장하기
 * @param {Object} events - 프론트엔드에서 보낸 전체 이벤트 객체
 */
export const saveCalendarEvents = async (events) => {
  try {
    // 포맷팅하여 JSON 저장
    await fs.promises.writeFile(
      FILE_PATH,
      JSON.stringify(events, null, 2),
      "utf8"
    );
    return true;
  } catch (error) {
    console.error("[CalendarService] Save Error:", error);
    throw new Error("일정을 저장하는 데 실패했습니다.");
  }
};