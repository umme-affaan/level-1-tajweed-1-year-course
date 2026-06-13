import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/build/pdf.worker.mjs";

const NOTES_DATA_URL = "notes.json";
const MOBILE_QUERY = window.matchMedia("(max-width: 1000px)");

const viewer = document.getElementById("viewer");
const pdfContainer = document.getElementById("pdfContainer");
const statusBox = document.getElementById("status");
const noteList = document.getElementById("noteList");
const overlay = document.getElementById("overlay");

const currentNoteName = document.getElementById("currentNoteName");
const scrollModeBtn = document.getElementById("scrollModeBtn");
const singleModeBtn = document.getElementById("singleModeBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const prevNoteBtn = document.getElementById("prevNoteBtn");
const nextNoteBtn = document.getElementById("nextNoteBtn");
const mobilePrevNoteBtn = document.getElementById("mobilePrevNoteBtn");
const mobileNextNoteBtn = document.getElementById("mobileNextNoteBtn");
const mobileChooseBtn = document.getElementById("mobileChooseBtn");
const chooseAnotherBtn = document.getElementById("chooseAnotherBtn");
const pageInput = document.getElementById("pageInput");
const totalPages = document.getElementById("totalPages");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomLabel = document.getElementById("zoomLabel");
const downloadLink = document.getElementById("downloadLink");
const tocToggle = document.getElementById("tocToggle");
const closeSidebar = document.getElementById("closeSidebar");

let notes = [];
let selectedNoteIndex = -1;
let pdfDoc = null;
let currentPage = 1;
let scale = MOBILE_QUERY.matches ? 1 : 1.25;
let mode = "scroll";
let observer = null;
let renderToken = 0;

function isMobile() {
  return MOBILE_QUERY.matches;
}

function openSidebar() {
  document.body.classList.add("sidebar-open");
}

function closeSidebarDrawer() {
  document.body.classList.remove("sidebar-open");
}

function showStatus(message) {
  statusBox.innerHTML = message;
  statusBox.style.display = "block";
}

function hideStatus() {
  statusBox.style.display = "none";
}

function currentNote() {
  return notes[selectedNoteIndex] || null;
}

function clampPage(pageNumber) {
  if (!pdfDoc) return 1;
  return Math.min(Math.max(Number(pageNumber) || 1, 1), pdfDoc.numPages);
}

function updateControls() {
  const hasPdf = Boolean(pdfDoc);
  const selected = currentNote();
  const hasDownload = Boolean(selected?.file);

  pageInput.disabled = !hasPdf;
  prevBtn.disabled = !hasPdf || currentPage <= 1;
  nextBtn.disabled = !hasPdf || currentPage >= pdfDoc.numPages;
  zoomOutBtn.disabled = !hasPdf;
  zoomInBtn.disabled = !hasPdf;
  scrollModeBtn.disabled = !hasPdf;
  singleModeBtn.disabled = !hasPdf;

  const atFirstNote = selectedNoteIndex <= 0;
  const atLastNote = selectedNoteIndex < 0 || selectedNoteIndex >= notes.length - 1;

  prevNoteBtn.disabled = atFirstNote;
  nextNoteBtn.disabled = atLastNote;
  mobilePrevNoteBtn.disabled = atFirstNote;
  mobileNextNoteBtn.disabled = atLastNote;

  if (hasPdf) {
    pageInput.value = currentPage;
    pageInput.max = pdfDoc.numPages;
    totalPages.textContent = `/ ${pdfDoc.numPages}`;
  } else {
    pageInput.value = 1;
    totalPages.textContent = "/ —";
  }

  zoomLabel.textContent = isMobile() ? "Fit" : `${Math.round(scale * 100)}%`;

  scrollModeBtn.classList.toggle("active", mode === "scroll");
  singleModeBtn.classList.toggle("active", mode === "single");

  document.querySelectorAll(".note-item").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.index) === selectedNoteIndex);
  });

  if (selected) {
    currentNoteName.textContent = `Note ${selected.number}: ${selected.title}`;
  } else {
    currentNoteName.textContent = "Select a note";
  }

  if (hasDownload) {
    downloadLink.href = selected.file;
    downloadLink.classList.remove("disabled");
    downloadLink.setAttribute("download", selected.file.split("/").pop());
  } else {
    downloadLink.href = "#";
    downloadLink.classList.add("disabled");
    downloadLink.removeAttribute("download");
  }
}

function buildNoteList() {
  noteList.innerHTML = "";

  notes.forEach((note, index) => {
    const button = document.createElement("button");
    button.className = "note-item";
    button.dataset.index = index;
    button.innerHTML = `
      <span class="note-topline">
        <span class="note-title">${note.title}</span>
        <span class="note-number">${String(note.number).padStart(2, "0")}</span>
      </span>
      <span class="note-urdu">${note.urdu || ""}</span>
    `;

    button.addEventListener("click", () => {
      loadNote(index);
      closeSidebarDrawer();
    });

    noteList.appendChild(button);
  });

  updateControls();
}

async function calculateRenderScale(page) {
  if (!isMobile()) {
    return scale;
  }

  const unscaledViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(viewer.clientWidth - 36, 260);
  const fitScale = availableWidth / unscaledViewport.width;

  return Math.min(Math.max(fitScale, 0.7), 2.2);
}

async function renderPdfPage(pageNumber, token) {
  const page = await pdfDoc.getPage(pageNumber);
  if (token !== renderToken) return null;

  const renderScale = await calculateRenderScale(page);
  const viewport = page.getViewport({ scale: renderScale });
  const outputScale = window.devicePixelRatio || 1;

  const wrapper = document.createElement("article");
  wrapper.className = "page-card";
  wrapper.id = `page-${pageNumber}`;
  wrapper.dataset.pageNumber = pageNumber;

  const label = document.createElement("div");
  label.className = "pdf-page-label";
  label.textContent = `Page ${pageNumber}`;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });

  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  wrapper.appendChild(label);
  wrapper.appendChild(canvas);

  await page.render({
    canvasContext: context,
    viewport,
    transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null
  }).promise;

  if (token !== renderToken) return null;
  return wrapper;
}

function setupPageObserver() {
  if (observer) observer.disconnect();

  observer = new IntersectionObserver(
    (entries) => {
      const visiblePages = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visiblePages.length > 0) {
        currentPage = Number(visiblePages[0].target.dataset.pageNumber);
        updateControls();
      }
    },
    {
      root: viewer,
      threshold: [0.35, 0.5, 0.75]
    }
  );

  document.querySelectorAll(".page-card").forEach((pageCard) => {
    observer.observe(pageCard);
  });
}

async function renderScrollMode() {
  const token = renderToken;
  showStatus("Loading pages…");
  pdfContainer.innerHTML = "";

  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
    if (token !== renderToken) return;

    const pageElement = await renderPdfPage(pageNumber, token);
    if (!pageElement) return;

    pdfContainer.appendChild(pageElement);

    if (pageNumber === 1) {
      hideStatus();
    }
  }

  hideStatus();
  setupPageObserver();
  updateControls();

  const target = document.getElementById(`page-${currentPage}`);
  if (target) target.scrollIntoView({ block: "start" });
}

async function renderSinglePage() {
  const token = renderToken;
  showStatus("Loading page…");
  pdfContainer.innerHTML = "";

  const pageElement = await renderPdfPage(currentPage, token);
  if (!pageElement || token !== renderToken) return;

  pdfContainer.appendChild(pageElement);
  hideStatus();
  updateControls();
  viewer.scrollTop = 0;

  if (observer) observer.disconnect();
}

async function renderCurrentMode() {
  if (!pdfDoc) return;

  if (mode === "scroll") {
    await renderScrollMode();
  } else {
    await renderSinglePage();
  }
}

async function loadNote(index) {
  const note = notes[index];
  if (!note) return;

  renderToken += 1;
  const token = renderToken;

  selectedNoteIndex = index;
  pdfDoc = null;
  currentPage = 1;

  mode = "scroll";

  if (observer) observer.disconnect();
  pdfContainer.innerHTML = "";

  updateControls();

  if (!note.file) {
    showStatus(`
      <strong>${note.title}</strong><br>
      This note does not have a PDF file connected yet.<br>
      Add the PDF to the <code>files</code> folder, then update its <code>file</code> value in <code>notes.json</code>.
    `);
    return;
  }

  showStatus(`Opening <strong>${note.title}</strong>…`);

  try {
    const loadingTask = pdfjsLib.getDocument(note.file);
    const loadedPdf = await loadingTask.promise;

    if (token !== renderToken) return;

    pdfDoc = loadedPdf;
    updateControls();
    await renderCurrentMode();
  } catch (error) {
    console.error(error);
    showStatus(`
      Could not open <strong>${note.title}</strong>.<br>
      Check that this file exists exactly here:<br>
      <code>${note.file}</code>
    `);
  }
}

async function goToPage(pageNumber) {
  if (!pdfDoc) return;

  currentPage = clampPage(pageNumber);
  updateControls();

  if (mode === "single") {
    renderToken += 1;
    await renderSinglePage();
    return;
  }

  const target = document.getElementById(`page-${currentPage}`);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function changeZoom(amount) {
  if (!pdfDoc || isMobile()) return;

  scale = Math.min(Math.max(scale + amount, 0.7), 2.4);
  renderToken += 1;
  updateControls();
  await renderCurrentMode();
}

async function loadPreviousNote() {
  if (selectedNoteIndex > 0) {
    await loadNote(selectedNoteIndex - 1);
  }
}

async function loadNextNote() {
  if (selectedNoteIndex < notes.length - 1) {
    await loadNote(selectedNoteIndex + 1);
  }
}

async function loadNotesData() {
  try {
    const response = await fetch(NOTES_DATA_URL);
    notes = await response.json();
    buildNoteList();
    showStatus(`
      <strong>Level-1 Tajweed Notes</strong><br>
      Select a note from the list to begin. Add your PDFs in the <code>files</code> folder, then update <code>notes.json</code> with the matching English file names.
    `);
  } catch (error) {
    console.error(error);
    showStatus("Could not load notes.json. Make sure the file is in your main project folder.");
  }
}

scrollModeBtn.addEventListener("click", async () => {
  if (!pdfDoc || mode === "scroll") return;
  mode = "scroll";
  renderToken += 1;
  await renderCurrentMode();
});

singleModeBtn.addEventListener("click", async () => {
  if (!pdfDoc || mode === "single") return;
  mode = "single";
  renderToken += 1;
  await renderCurrentMode();
});

prevBtn.addEventListener("click", () => goToPage(currentPage - 1));
nextBtn.addEventListener("click", () => goToPage(currentPage + 1));

prevNoteBtn.addEventListener("click", loadPreviousNote);
nextNoteBtn.addEventListener("click", loadNextNote);
mobilePrevNoteBtn.addEventListener("click", loadPreviousNote);
mobileNextNoteBtn.addEventListener("click", loadNextNote);

pageInput.addEventListener("change", () => {
  goToPage(pageInput.value);
});

zoomOutBtn.addEventListener("click", () => changeZoom(-0.15));
zoomInBtn.addEventListener("click", () => changeZoom(0.15));

tocToggle.addEventListener("click", openSidebar);
mobileChooseBtn.addEventListener("click", openSidebar);
chooseAnotherBtn.addEventListener("click", openSidebar);
closeSidebar.addEventListener("click", closeSidebarDrawer);
overlay.addEventListener("click", closeSidebarDrawer);

document.addEventListener("keydown", (event) => {
  if (event.target.tagName === "INPUT") return;

  if (event.key === "ArrowLeft") goToPage(currentPage - 1);
  if (event.key === "ArrowRight") goToPage(currentPage + 1);
  if (event.key === "Escape") closeSidebarDrawer();
});

let resizeTimer = null;

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);

  resizeTimer = setTimeout(async () => {
    if (!pdfDoc) return;

    renderToken += 1;
    updateControls();
    await renderCurrentMode();
  }, 250);
});

loadNotesData();
