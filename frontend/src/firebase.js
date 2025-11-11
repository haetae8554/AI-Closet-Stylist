import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDynQjUwKGqAIt9spKdKfLse67ulYajLF4",
    authDomain: "ai-closet-stylist-ebcff.firebaseapp.com",
    projectId: "ai-closet-stylist-ebcff",
    storageBucket: "ai-closet-stylist-ebcff.appspot.com",
    messagingSenderId: "328640272584",
    appId: "1:328640272584:web:9b754dd163c4fa1c51edfd",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
