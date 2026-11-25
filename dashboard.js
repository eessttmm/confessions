import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, getDocs, query, where, limit,
  updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginPanel = document.querySelector("#loginPanel");
const dashboard = document.querySelector("#dashboard");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const loginButton = document.querySelector("#loginButton");
const logoutButton = document.querySelector("#logoutButton");
const loginMessage = document.querySelector("#loginMessage");
const adminFeed = document.querySelector("#adminFeed");

function setLoginMessage(text, isError = false) {
  loginMessage.textContent = text;
  loginMessage.classList.toggle("error", isError);
}
function formatDate(value) {
  if (!value?.toDate) return "Date unavailable";
  return value.toDate().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function friendlyAuthError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-api-key") || code.includes("api-key-not-valid")) {
    return "Firebase rejected the website API key. Check firebase-config.js against Firebase Project settings.";
  }
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Email or password is incorrect.";
  }
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait and try again.";
  if (code.includes("network-request-failed")) return "Network error. Check your internet connection.";
  if (code.includes("operation-not-allowed")) return "Email/password sign-in is not enabled in Firebase Authentication.";
  return `Sign-in failed (${code || "unknown error"}). Check Firebase Authentication settings.`;
}
function showAdminMessage(text) {
  const el = document.createElement("div");
  el.className = "empty panel";
  el.textContent = text;
  adminFeed.replaceChildren(el);
}

loginButton.addEventListener("click", async () => {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!email || !password) return setLoginMessage("Enter your admin email and password.", true);
  if (email !== ADMIN_EMAIL.toLowerCase()) {
    return setLoginMessage("This account is not authorized for the admin dashboard.", true);
  }

  loginButton.disabled = true;
  setLoginMessage("Signing in…");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    passwordInput.value = "";
    setLoginMessage("");
  } catch (error) {
    console.error("Admin sign-in error:", error);
    setLoginMessage(friendlyAuthError(error), true);
  } finally {
    loginButton.disabled = false;
  }
});

passwordInput.addEventListener("keydown", event => {
  if (event.key === "Enter") loginButton.click();
});
emailInput.addEventListener("keydown", event => {
  if (event.key === "Enter") passwordInput.focus();
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-out error:", error);
  }
});

document.querySelector("#adminRefresh").addEventListener("click", loadDashboard);

onAuthStateChanged(auth, async user => {
  if (user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    loginPanel.hidden = true;
    dashboard.hidden = false;
    document.querySelector("#signedInAs").textContent = `Signed in as ${user.email}`;
    await loadDashboard();
  } else {
    if (user) await signOut(auth);
    loginPanel.hidden = false;
    dashboard.hidden = true;
  }
});

async function loadDashboard() {
  showAdminMessage("Loading submissions…");
  try {
    const confessionSnap = await getDocs(query(collection(db, "confessions"), limit(300)));
    const items = confessionSnap.docs.map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    if (!items.length) {
      showAdminMessage("No submissions yet.");
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const card = document.createElement("article");
      card.className = "admin-card panel";

      const head = document.createElement("div");
      head.className = "confession-head";
      const status = document.createElement("span");
      status.className = "status";
      status.textContent = item.status === "published" ? "Published" : "Hidden";
      const time = document.createElement("time");
      time.className = "timestamp";
      time.textContent = formatDate(item.createdAt);
      head.append(status, time);

      const body = document.createElement("p");
      body.className = "confession-text";
      body.textContent = typeof item.text === "string" ? item.text : "";

      const actions = document.createElement("div");
      actions.className = "admin-actions";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "small-button";
      toggle.textContent = item.status === "published" ? "Hide confession" : "Publish confession";
      toggle.addEventListener("click", async () => {
        toggle.disabled = true;
        try {
          await updateDoc(doc(db, "confessions", item.id), {
            status: item.status === "published" ? "hidden" : "published"
          });
          await loadDashboard();
        } catch (error) {
          console.error("Status update error:", error);
          alert("Could not update this confession. Check Firestore rules.");
          toggle.disabled = false;
        }
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "small-button danger";
      remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        if (!confirm("Permanently delete this confession?")) return;
        remove.disabled = true;
        try {
          await deleteDoc(doc(db, "confessions", item.id));
          // Also remove the private technical record linked to this confession.
          const linked = await getDocs(query(collection(db, "submissionDetails"), where("confessionId", "==", item.id)));
          await Promise.all(linked.docs.map(d => deleteDoc(doc(db, "submissionDetails", d.id))));
          await loadDashboard();
        } catch (error) {
          console.error("Delete error:", error);
          alert("Could not delete this submission. Check Firestore rules.");
          remove.disabled = false;
        }
      });

      actions.append(toggle, remove);
      card.append(head, body, actions);
      fragment.append(card);
    }
    adminFeed.replaceChildren(fragment);
  } catch (error) {
    console.error("Admin dashboard loading error:", error);
    showAdminMessage("Couldn't load the admin inbox. Check your Firestore rules and connection, then refresh.");
  }
}
