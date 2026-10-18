# Books

An independent, minimal PDF bookshelf for **books.ronyu.me**.
No connection to the blog, no framework, no external fonts, and no third-party requests.

## Add books

Put PDF files in `public/books/`, commit, and push to `main`.
The Action automatically rebuilds the list and publishes the site.
Nested folders and filenames with spaces or Chinese characters are supported.
A filename such as `Title (Author).pdf` displays the author below the title.

The builder only lists filenames and file sizes, then copies the PDFs unchanged.
It never reads, extracts, renders, or indexes the contents of books.
Tests use temporary, synthetic files only.

## Local preview

Node.js 22 or newer is sufficient to build. No dependency installation is needed.

```sh
npm test
npm run build
npm run preview
```

Open http://localhost:4174/. The preview command uses Python 3’s static server.
Clicking a book title opens the PDF in a new tab; the download button saves it.

## Independent deployment

This project belongs in its own GitHub repository, separate from the blog.
In that repository, set **Settings → Pages → Source** to **GitHub Actions** and
set the custom domain to `books.ronyu.me` (`public/CNAME` records it as well).
The workflow builds and deploys on pushes to `main`, or can be started manually.
It uses the built-in `GITHUB_TOKEN`; no personal access token is required.

At the DNS provider for `ronyu.me`, add:

| Type | Name | Target |
| --- | --- | --- |
| CNAME | books | oxkrypton.github.io |

Once GitHub validates the domain and provisions the certificate, enable
**Enforce HTTPS** in Pages settings. The existing `ronyu.me` blog configuration
is independent and does not need to change.
