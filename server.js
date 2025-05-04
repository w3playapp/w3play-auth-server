// 🇷🇺 Зависимости
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { verifyMessage } from "ethers";
import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

// 🇷🇺 Загрузка переменных окружения
dotenv.config();

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_KEY_BASE64, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ Server is running!");
});

app.post("/verify", async (req, res) => {
  const { address, message, signature } = req.body;

  try {
    const recoveredAddress = verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(400).json({ error: "Signature does not match the address." });
    }

    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("wallet", "==", address.toLowerCase()).limit(1).get();

    let uid, username;

    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      uid = userDoc.id;
      username = userDoc.data().username || `user_${Math.floor(1000 + Math.random() * 9000)}`;
    } else {
      uid = uuidv4();
      username = `user_${Math.floor(1000 + Math.random() * 9000)}`;
      await usersRef.doc(uid).set({
        wallet: address.toLowerCase(),
        username,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const token = await admin.auth().createCustomToken(uid);
    res.json({ token, username, wallet: address.toLowerCase() });

  } catch (err) {
    console.error("Signature verification failed:", err);
    res.status(500).json({ error: "Verification error" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server is running: http://localhost:${PORT}`);
});
