// src/firebase.js
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = resolve(__dirname, "../serviceAccount.json");
let serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));

// 🔥 핵심: private_key의 \n을 실제 줄바꿈으로 변환
if (typeof serviceAccount.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(
        /\\n/g,
        "\n"
    );
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${serviceAccount.project_id}.appspot.com`,
    });
}

export const db = admin.firestore();
export const storage = admin.storage();
