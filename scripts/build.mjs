import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

async function listBooks(directory, relativeDirectory = "") {
  const books = [];
  const entries = await readdir(path.join(directory, relativeDirectory), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      books.push(...await listBooks(directory, relativePath));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf") {
      // Inspect the filename and file size only. Never open or parse a PDF.
      const metadata = await stat(path.join(directory, relativePath));
      const stem = entry.name.slice(0, -4).trim();
      const match = /^(.*?)\s+\(([^()]+)\)$/.exec(stem);
      books.push({
        relativePath,
        filename: entry.name,
        title: match ? match[1] : stem,
        author: match ? match[2] : "",
        size: metadata.size,
        href: `/books/${relativePath.split(path.sep).map(encodeURIComponent).join("/")}`,
      });
    }
  }
  return books;
}

function renderBook(book, index) {
  const href = escapeHtml(book.href);
  const title = escapeHtml(book.title);
  const author = book.author ? `<span>${escapeHtml(book.author)}</span><span class="separator" aria-hidden="true">·</span>` : "";
  return `          <article class="book">
            <span class="number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
            <div class="book-info">
              <a class="book-title" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${title}（打开 PDF，新标签页）">${title}<span class="open-arrow" aria-hidden="true">↗</span></a>
              <p class="book-meta">${author}<span>PDF</span><span class="separator" aria-hidden="true">·</span><span>${formatSize(book.size)}</span></p>
            </div>
            <a class="download" href="${href}" download="${escapeHtml(book.filename)}" aria-label="下载 ${title}">下载 <span aria-hidden="true">↓</span></a>
          </article>`;
}

export async function buildSite({ rootDir = projectRoot } = {}) {
  const booksDir = path.join(rootDir, "public", "books");
  const outDir = path.join(rootDir, "dist");
  await mkdir(booksDir, { recursive: true });
  const books = (await listBooks(booksDir)).sort((a, b) =>
    collator.compare(a.title, b.title) || collator.compare(a.relativePath, b.relativePath)
  );
  const template = await readFile(path.join(rootDir, "src", "index.html"), "utf8");
  const rows = books.length ? books.map(renderBook).join("\n") : '          <p class="empty">书架还空着，留一点位置给下一本书。</p>';
  const html = template.replace("{{BOOK_COUNT}}", String(books.length)).replace("{{BOOK_ROWS}}", () => rows);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "index.html"), html);
  await copyFile(path.join(rootDir, "src", "styles.css"), path.join(outDir, "styles.css"));
  await copyFile(path.join(rootDir, "public", "CNAME"), path.join(outDir, "CNAME"));
  await writeFile(path.join(outDir, ".nojekyll"), "");
  for (const book of books) {
    const destination = path.join(outDir, "books", book.relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    // Copy the file as-is; no extraction, rendering, indexing or content inspection.
    await copyFile(path.join(booksDir, book.relativePath), destination);
  }
  return { count: books.length, outDir };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await buildSite();
  console.log(`Built ${result.count} book(s) into ${result.outDir}. PDF contents were not inspected.`);
}
