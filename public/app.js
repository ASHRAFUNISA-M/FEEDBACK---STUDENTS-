import {
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  collection,
  addDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const feedbackForm = document.querySelector("#feedbackForm");
const feedbackList = document.querySelector("#feedbackList");
const statusMessage = document.querySelector("#statusMessage");
const downloadButton = document.querySelector("#downloadFeedback");
const STORAGE_KEY = "campusVoiceFeedback";
let currentFeedback = [];

const setStatus = (text, type = "") => {
  statusMessage.textContent = text;
  statusMessage.className = "status-message";

  if (type) {
    statusMessage.classList.add(type);
  }
};

const getLocalFeedback = () => {
  try {
    const storedFeedback = localStorage.getItem(STORAGE_KEY);
    if (!storedFeedback) {
      return [];
    }

    const parsedFeedback = JSON.parse(storedFeedback);
    return Array.isArray(parsedFeedback) ? parsedFeedback : [];
  } catch (error) {
    console.error("Unable to read local feedback:", error);
    return [];
  }
};

const saveLocalFeedback = (entries) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

const isFirebaseConfigValid = (config) => {
  if (!config) {
    return false;
  }

  const requiredKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];

  return requiredKeys.every((key) => {
    const value = config[key];
    return typeof value === "string" && value.trim() && !value.includes("YOUR_");
  });
};

const formatDate = (timestamp) => {
  if (!timestamp) {
    return "Just now";
  }

  const dateValue = typeof timestamp === "number"
    ? new Date(timestamp)
    : typeof timestamp === "string"
      ? new Date(timestamp)
      : timestamp.seconds
        ? new Date(timestamp.seconds * 1000)
        : new Date(timestamp);

  if (Number.isNaN(dateValue.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(dateValue);
};

const renderStars = (rating) => {
  const numericRating = Number(rating) || 0;
  return Array.from({ length: 5 }, (_, index) => (index < numericRating ? "★" : "☆")).join("");
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const escapeXml = (value) =>
  Array.from(String(value ?? ""))
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd
        || (codePoint >= 0x20 && codePoint <= 0xd7ff)
        || (codePoint >= 0xe000 && codePoint <= 0xfffd)
        || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    })
    .join("")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const renderFeedback = (documents) => {
  const entries = documents.map((document) => {
    if (typeof document?.data === "function") {
      return document.data();
    }

    return document;
  });

  currentFeedback = entries;
  downloadButton.disabled = entries.length === 0;

  if (!entries.length) {
    feedbackList.innerHTML = '<div class="empty-state">No feedback submitted yet. Be the first to share your experience.</div>';
    return;
  }

  feedbackList.innerHTML = entries
    .map((entry) => {
      const { studentName, message, rating, createdAt } = entry;
      const safeName = escapeHtml(studentName || "Anonymous Student");
      const safeMessage = escapeHtml(message || "No message provided.");

      return `
        <article class="feedback-card">
          <div class="feedback-head">
            <h3 class="student-name">${safeName}</h3>
            <span class="rating-badge">${renderStars(rating)} (${rating || 0}/5)</span>
          </div>
          <p class="feedback-message">${safeMessage}</p>
          <div class="feedback-meta">Submitted on ${formatDate(createdAt)}</div>
        </article>
      `;
    })
    .join("");
};

downloadButton.addEventListener("click", () => {
  const rows = [
    ["Student Name", "Feedback Message", "Rating", "Submitted On"],
    ...currentFeedback.map(({ studentName, message, rating, createdAt }) => [
      studentName || "Anonymous Student",
      message || "No message provided.",
      rating || 0,
      formatDate(createdAt),
    ]),
  ];
  const worksheetRows = rows
    .map((row) => `<Row>${row
      .map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`)
      .join("")}</Row>`)
    .join("");
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Feedback">
    <Table>${worksheetRows}</Table>
  </Worksheet>
</Workbook>`;
  const file = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = "student-feedback.xls";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

if (!isFirebaseConfigValid(window.firebaseConfig)) {
  console.warn("Firebase configuration is not set. Using local preview mode until valid project settings are added.");
  renderFeedback(getLocalFeedback());
  setStatus("Cloud demo mode active — this preview simulates live cloud sync for the project.", "warning");

  feedbackForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(feedbackForm);
    const studentName = String(formData.get("studentName") || "").trim();
    const message = String(formData.get("feedbackMessage") || "").trim();
    const rating = Number(formData.get("rating"));

    if (!studentName || !message || !rating || rating < 1 || rating > 5) {
      setStatus("Please complete all fields and choose a rating from 1 to 5.", "error");
      return;
    }

    const currentFeedback = getLocalFeedback();
    const nextFeedback = [{
      studentName,
      message,
      rating,
      createdAt: new Date().toISOString(),
    }, ...currentFeedback];

    saveLocalFeedback(nextFeedback);
    renderFeedback(nextFeedback);
    feedbackForm.reset();
    setStatus("Cloud demo sync complete — your feedback was saved in the project preview environment.", "success");
  });
} else {
  const app = initializeApp(window.firebaseConfig);
  const db = getFirestore(app);
  const feedbackCollection = collection(db, "feedback");
  const feedbackQuery = query(feedbackCollection, orderBy("createdAt", "desc"));

  onSnapshot(
    feedbackQuery,
    (snapshot) => {
      renderFeedback(snapshot.docs);
    },
    (error) => {
      console.error("Failed to load feedback:", error);
      setStatus("Unable to load feedback right now. Please refresh the page.", "error");
    }
  );

  feedbackForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(feedbackForm);
    const studentName = String(formData.get("studentName") || "").trim();
    const message = String(formData.get("feedbackMessage") || "").trim();
    const rating = Number(formData.get("rating"));

    if (!studentName || !message || !rating || rating < 1 || rating > 5) {
      setStatus("Please complete all fields and choose a rating from 1 to 5.", "error");
      return;
    }

    setStatus("Submitting your feedback...", "");

    try {
      await addDoc(feedbackCollection, {
        studentName,
        message,
        rating,
        createdAt: serverTimestamp(),
      });

      feedbackForm.reset();
      setStatus("Thank you! Your feedback was submitted successfully.", "success");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setStatus("Something went wrong while submitting feedback. Please try again.", "error");
    }
  });
}
