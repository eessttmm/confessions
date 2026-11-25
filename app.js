import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, where, getDocs, limit
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { detectModelId, friendlyNameFor, formatDevice } from "./device-model.js?v=5";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const textBox = document.querySelector("#confession");
const postButton = document.querySelector("#postButton");
const message = document.querySelector("#formMessage");
const feed = document.querySelector("#feed");
const counter = document.querySelector("#counter");
const refreshButton = document.querySelector("#refreshButton");

function say(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

textBox.addEventListener("input", () => {
  counter.textContent = `${textBox.value.length} / 1000`;
});

async function getDeviceDetails() {
  const ua = navigator.userAgent || "";
  const platform = navigator.userAgentData?.platform || navigator.platform || "Unknown";
  let browser = "Unknown browser";
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/CriOS|Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  const os = /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
    : /Windows/i.test(ua) ? "Windows"
    : /Mac OS/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux" : platform;

  const deviceType = /Mobi|Android|iPhone/i.test(ua) ? "Mobile" : "Desktop / tablet";
  const modelId = await detectModelId();
  const deviceName = friendlyNameFor(modelId);
  const details = {
    deviceType,
    browser,
    os,
    deviceName: deviceName || null,
    modelId: modelId || null
  };
  details.model = formatDevice(details);
  return details;
}

function formatDate(value) {
  if (!value?.toDate) return "Just now";
  return value.toDate().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function showFeedMessage(text) {
  const el = document.createElement("div");
  el.className = "empty panel";
  el.textContent = text;
  feed.replaceChildren(el);
}

async function loadFeed() {
  showFeedMessage("Loading confessions…");
  try {
    // No orderBy: avoids requiring a composite Firestore index.
    const q = query(
      collection(db, "confessions"),
      where("status", "==", "published"),
      limit(100)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      showFeedMessage("No confessions yet. Be the first to post.");
      return;
    }

    const docs = [...snap.docs].sort((a, b) => {
      const aTime = a.data().createdAt?.toMillis?.() || 0;
      const bTime = b.data().createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    const fragment = document.createDocumentFragment();
    for (const docSnap of docs) {
      const data = docSnap.data();
      const card = document.createElement("article");
      card.className = "confession panel";

      const head = document.createElement("div");
      head.className = "confession-head";

      const who = document.createElement("span");
      who.className = "anonymous";
      who.textContent = "Anonymous";

      const time = document.createElement("time");
      time.className = "timestamp";
      time.textContent = formatDate(data.createdAt);
      head.append(who, time);

      const body = document.createElement("p");
      body.className = "confession-text";
      body.textContent = typeof data.text === "string" ? data.text : "";

      card.append(head, body);
      fragment.append(card);
    }
    feed.replaceChildren(fragment);
  } catch (error) {
    console.error("Public confession feed error:", error);
    showFeedMessage("Confessions are temporarily unavailable. Please try again in a little while.");
  }
}

postButton.addEventListener("click", async () => {
  const text = textBox.value.trim();
  if (text.length < 3) return say("Please write at least 3 characters.", true);
  if (text.length > 1000) return say("Your confession is too long.", true);

  postButton.disabled = true;
  say("Posting…");

  try {
    const confessionRef = await addDoc(collection(db, "confessions"), {
      text,
      status: "published",
      createdAt: serverTimestamp()
    });

    // Save disclosed basic browser/device details separately.
    // A failure here does not undo or misreport the successful confession post.
    try {
      const details = await getDeviceDetails();
      const anonymousId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      await addDoc(collection(db, "submissionDetails"), {
        confessionId: confessionRef.id,
        anonymousId,
        details,
        createdAt: serverTimestamp()
      });
    } catch (detailsError) {
      console.warn("Private submission details could not be saved:", detailsError);
    }

    textBox.value = "";
    counter.textContent = "0 / 1000";
    say("Your confession has been posted.");
    await loadFeed();
  } catch (error) {
    console.error("Confession submission error:", error);
    say("Couldn't post right now. Please try again later.", true);
  } finally {
    postButton.disabled = false;
  }
});

refreshButton.addEventListener("click", loadFeed);
loadFeed();
