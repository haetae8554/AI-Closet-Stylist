// src/apiConfig.js


// 개발중인 로컬호스트 ip주소
const LOCAL_IP = "http://localhost:3001"; 

// 배포시 주소(backend)
const PROD_URL = "http://192.168.0.101:3000";

// 코드에서 사용할 주소
export const API_BASE_URL = LOCAL_IP;
// export const API_BASE_URL = PROD_URL;