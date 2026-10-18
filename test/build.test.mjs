import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "../scripts/build.mjs";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

async function fixture(t) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "books-test-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  await mkdir(path.join(rootDir, "src"), { recursive: true });
  await mkdir(path.join(rootDir, "public", "books"), { recursive: true });
  await copyFile(path.join(sourceRoot, "src", "index.html"), path.join(rootDir, "src", "index.html"));
  await copyFile(path.join(sourceRoot, "src", "styles.css"), path.join(rootDir, "src", "styles.css"));
  await writeFile(path.join(rootDir, "public", "CNAME"), "books.ronyu.me\n");
  return rootDir;
}

test("builds links from names and sizes, with nested paths and uppercase extensions", async (t) => {
  const rootDir = await fixture(t);
  const booksDir = path.join(rootDir, "public", "books");
  const filename = "100 Go Mistakes (Teiva Harsanyi) .pdf";
  await writeFile(path.join(booksDir, filename), Buffer.alloc(2048));
  await mkdir(path.join(booksDir, "中文 分类"));
  await writeFile(path.join(booksDir, "中文 分类", "一本书 #1.PDF"), Buffer.alloc(32));
  await writeFile(path.join(booksDir, "ignore.txt"), "not a book");
  await writeFile(path.join(booksDir, ".hidden.pdf"), "hidden");
  await symlink(path.join(booksDir, filename), path.join(booksDir, "linked.pdf"));
  const { count, outDir } = await buildSite({ rootDir });
  assert.equal(count, 2);
  const html = await readFile(path.join(outDir, "index.html"), "utf8");
  assert.match(html, /100 Go Mistakes/);
  assert.match(html, /Teiva Harsanyi/);
  assert.match(html, /2\.0 KB/);
  assert.ok(html.includes(`/books/${encodeURIComponent(filename)}`));
  assert.ok(html.includes(`/books/${encodeURIComponent("中文 分类")}/${encodeURIComponent("一本书 #1.PDF")}`));
  assert.ok(html.includes(`download="${filename}"`));
  assert.ok(!html.includes("ignore.txt"));
  assert.ok(!html.includes("linked.pdf"));
  assert.ok(!html.includes("{{BOOK_"));
  assert.equal((await stat(path.join(outDir, "books", filename))).size, 2048);
  assert.equal((await readFile(path.join(outDir, "CNAME"), "utf8")).trim(), "books.ronyu.me");
  assert.equal((await stat(path.join(outDir, ".nojekyll"))).size, 0);
});

test("escapes book titles and download attributes instead of interpreting filename markup", async (t) => {
  const rootDir = await fixture(t);
  const filename = 'Cash $& <img onerror="alert(1)"> & \'quoted\'.pdf';
  await writeFile(path.join(rootDir, "public", "books", filename), Buffer.alloc(1));
  const { outDir } = await buildSite({ rootDir });
  const html = await readFile(path.join(outDir, "index.html"), "utf8");
  assert.ok(html.includes("Cash $&amp; &lt;img onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quoted&#39;"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes(encodeURIComponent(filename).replaceAll("'", "&#39;")));
  assert.ok(!html.includes("{{BOOK_ROWS}}"));
});

test("handles an empty library and removes stale books after rebuilding", async (t) => {
  const rootDir = await fixture(t);
  const pdf = path.join(rootDir, "public", "books", "Temporary.pdf");
  await writeFile(pdf, Buffer.alloc(5));
  await buildSite({ rootDir });
  await rm(pdf);
  const { count, outDir } = await buildSite({ rootDir });
  assert.equal(count, 0);
  const html = await readFile(path.join(outDir, "index.html"), "utf8");
  assert.ok(html.includes("0 本书"));
  assert.ok(html.includes("书架还空着"));
  assert.ok(!html.includes("Temporary.pdf"));
  await assert.rejects(stat(path.join(outDir, "books", "Temporary.pdf")), { code: "ENOENT" });
});
