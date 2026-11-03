# Obsidian-to-WordPress: An Obsidian -> WordPress Publishing Plugin for WordPress

Publish your Obsidian notes directly to WordPress as Gutenberg block-formatted posts. This plugin converts Obsidian-flavored markdown (including callouts, wikilinks, and standard formatting) into WordPress block markup, handles image uploads to your WordPress media library, and authenticates securely using Application Passwords.

**This is a maintained fork of [serabi/obsidian-to-wp](https://github.com/serabi/obsidian-to-wp)** (MIT), focused on *repeated publishing* — writing, revising and re-publishing the same note over and over without losing your frontmatter. See [Why this fork](#why-this-fork) for what changed.

## Why this fork

Upstream publishes a note perfectly well. Issues appear when the same note is published repeatedly as part of a writing system:

| Upstream problem | What breaks |
|---|---|
| Frontmatter is rewritten from a whitelist | Unknown fields (`series`, `digest`, custom state flags) are silently dropped after publishing |
| No notion of a "final" cutoff | Outlines, TODOs and HTML comments kept above the article body are published along with it |
| `status` is assumed to be a WordPress status | Custom field semantics are pushed to WordPress as-is |
| No featured image support | The `image` field is ignored (still listed as "planned") |
| Images are uploaded unconditionally | Every publish adds another copy to the media library |
| YAML parsed with a loose schema | Booleans and dates come back as strings |

Upstream had been quiet for roughly ten months, so I forked it for my own pipeline. **Nothing here is merged upstream**; if you only need a one-shot publish, use the original instead.

## Added in this fork

- **Frontmatter is preserved** — every unrecognized field is written back verbatim, so `series`, `digest`, `stage` and `mp_*` survive a publish.
- **`Post final :` marker** — only content *after* the marker line is published; everything above it (outlines, TODOs, comment blocks) stays local. The marker string is configurable in the settings.
- **Empty means absent** — empty fields are deleted rather than written back as `'null'` / `'undefined'` placeholders (this is what caused permanently-null excerpts).
- **Status validation** — only `draft`, `publish`, `private`, `future` are sent to WordPress; anything else falls back to the plugin default, so a human workflow field never leaks into the post status.
- **Excerpt fallback** — when `excerpt` is empty, `digest` is used.
- **Featured image** — the `image` field (filename or wikilink) is uploaded and set as the featured image.
- **Media reuse by filename** — an existing file with the same name is reused instead of uploaded again.
- **Strict YAML schema** — booleans and dates keep their types.
- **Read more marker** — a standalone `<!--more-->` line becomes a native Gutenberg "Read more" block, so archive pages stop showing the full post.
- **Markdown tables** — standard GFM tables become native `wp:table` blocks, with inline formatting inside cells.

## Currently Included Features

- **One-click publishing** - Publish notes via command palette or right-click context menu
- **Gutenberg block output** - Converts markdown to native WordPress block format
- **Image uploads** - Automatically uploads local images to WordPress media library; files already present under the same filename are reused rather than uploaded again (rename the file whenever you change an image's content)
- **Featured image** - `image` in frontmatter is uploaded and set as the featured image
- **Post final marker** - Only content below the marker line is published
- **Frontmatter preserving** - Unknown fields such as `series`, `digest` or `stage` are kept
- **Excerpt fallback** - Falls back to `digest` when `excerpt` is empty
- **Folder scoping** - Restrict publishing to notes in a specific folder
- **Frontmatter control** - Set post properties like title, slug, categories, tags, excerpt, and scheduled date
- **Post status control** - Publish as draft, published, private, or scheduled (per-post or default setting)
- **Update support** - Re-publish notes to update existing WordPress posts (_NOTE: still needs more testing! use with caution._)

## Installation

> Both forks ship the **same plugin id** (`obsidian-to-wp`). If the original `serabi/obsidian-to-wp` is installed, remove it first — otherwise Obsidian will not know which one to load.

### Using BRAT (recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian Community Plugins
2. Open **Settings > BRAT > Add Beta plugin**
3. Enter the repository URL: `lidetao/obsidian-to-wp`
4. Select **Add Plugin**
5. Enable the plugin in **Settings > Community plugins**

BRAT will automatically check for updates and keep your plugin current.

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder named `obsidian-to-wp` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into this folder
4. Reload Obsidian and enable the plugin in **Settings > Community plugins**

## Setup

### WordPress Configuration

1. Ensure your WordPress site has the REST API enabled (yes, you can do this on WordPress.com!) 
2. Create an Application Password:
   - Go to **Users > Profile** in WordPress admin
   - Scroll to **Application Passwords**
   - Enter a name (e.g., "Obsidian Publisher") and click **Add New Application Password**
   - Copy the generated password to someplace safe, like a password manager (you won't see it again)

### Plugin Settings

1. Open Obsidian **Settings > Obsidian to WordPress**
2. Enter your WordPress site URL (e.g., `https://example.com`)
3. Enter your WordPress username
4. Enter the Application Password you created
5. Click **Test** to verify the connection
6. Optionally configure:
   - **Publishable folder** - Only notes in this folder can be published
   - **Default post status** - Draft, Published, or Private
   - **Upload images** - Toggle automatic image uploads

## Usage

### Publishing a Note

**Option 1: Command Palette**
1. Open the note you want to publish
2. Press `Cmd/Ctrl + P` to open the command palette
3. Search for "Publish current note to WordPress"
4. Press Enter

**Option 2: Context Menu**
1. Right-click on a note in the file explorer
2. Select **Publish to WordPress**

Or right-click in the editor and select **Publish to WordPress**.

### Frontmatter Options

Control post properties using YAML frontmatter at the top of your note:

```yaml
---
title: My Blog Post Title
slug: my-custom-url-slug
status: draft
categories:
  - Technology
  - Tutorials
tags:
  - obsidian
  - wordpress
excerpt: A brief summary of my post for previews and SEO
date: 2024-12-25T10:00:00
---
```

| Field | Description |
|-------|-------------|
| `title` | Post title (defaults to filename) |
| `slug` | URL slug/permalink |
| `status` | `draft`, `publish`, `private`, or `future` (any other value falls back to the plugin default) |
| `categories` | List of category names (created if they don't exist) |
| `tags` | List of tag names (created if they don't exist) |
| `excerpt` | Post excerpt/summary; falls back to `digest` when empty |
| `image` | Cover image file name or `![[wikilink]]`; uploaded and set as the featured image |
| `digest` | Fallback excerpt (handy if you keep separate summaries per channel) |
| `date` | Scheduled publish date (ISO 8601 format, requires `status: future`) |
| `wp_post_id` | WordPress post ID (auto-set after first publish) |
| `wp_post_url` | WordPress post URL (auto-set after publish) |

Any other field is **preserved verbatim**. Empty fields are removed rather than written back as a placeholder.

### Post final marker

Notes usually carry material that should not be published — outlines, TODOs, comment blocks. Put a marker line before the article body and everything above it stays local:

```markdown
<!--
Outline, TODOs, sources. Never published.
-->

Post final :

## The actual article starts here
```

The default marker is `Post final :` and it can be changed (or emptied to publish the whole note) in the plugin settings. If the marker is not found, the full note is published — check the spelling before blaming the plugin.

### Tables and the read more marker

Standard GFM tables are converted into native `wp:table` blocks, with inline formatting inside cells:

```markdown
| Field | Value |
| --- | --- |
| `status` | `publish` |
```

Put `<!--more-->` on a line of its own where the archive page should stop:

```markdown
Introduction paragraph.

<!--more-->

## Rest of the article
```

It is emitted in WordPress's native three-line form (`<!-- wp:more -->`, `<!--more-->`, `<!-- /wp:more -->`). Only the first marker is used; a marker inside a fenced code block is treated as code. Whether the front page actually truncates depends on the theme calling `the_content()` — themes that render `the_excerpt()` use the `excerpt` / `digest` field instead.

### Updating Published Posts

After publishing a note, the plugin adds a `wp_post_id` field to the frontmatter. Subsequent publishes will update the existing WordPress post instead of creating a new one.

## Markdown Support

The plugin converts the following Obsidian markdown elements to Gutenberg blocks:

| Obsidian | WordPress Block |
|----------|----------------|
| Headings (`#`, `##`, etc.) | Heading block |
| Paragraphs | Paragraph block |
| Code blocks | Code block |
| Blockquotes (`>`) | Quote block |
| Unordered lists (`-`, `*`) | List block |
| Ordered lists (`1.`, `2.`) | List block (ordered) |
| Images (`![]()`, `![[]]`) | Image block |
| Callouts (`> [!note]`) | Quote block with callout styling |
| Horizontal rules (`---`) | Separator block |
| GFM tables (`\| a \| b \|`) | Table block |
| `<!--more-->` on its own line | More ("Read more") block |

### Inline Formatting

- **Bold** (`**text**`)
- *Italic* (`*text*`)
- ~~Strikethrough~~ (`~~text~~`)
- `Inline code` (`` `code` ``)
- ==Highlights== (`==text==`)
- [Links](url) (`[text](url)`)
- Wikilinks are converted to plain text

## Known limitations

- **Status is one-way.** The plugin does not read the real status from WordPress. If you publish from the WordPress admin instead, update `status: publish` in your note afterwards — otherwise the next publish will send `draft` again and pull the live post back into drafts.
- **Media reuse is by filename only.** Change an image's content under the same name and WordPress keeps using the old file; rename it to upload a new one.
- **No create fallback on update.** Once `wp_post_id` is set, publishing sends a `PUT`. If that post was deleted at WordPress side, clear `wp_post_id` in the note so a new one is created.
- Not merged upstream; picking up upstream changes requires a manual merge.
- **Tables are standard GFM only.** Column alignment markers and fixed layout are not carried over. Avoid a literal `|` inside a cell — other renderers reading the same note (e.g. Dou Publish for WeChat) may split it into an extra column.
- **The read more marker depends on the theme.** The block itself is emitted correctly, but a theme rendering `the_excerpt()` ignores it; use `excerpt` / `digest` in that case.

## Roadmap

### Planned Features

- Custom post type support
- Conflict detection and resolution
- Other ideas? Please share under Issues :) 

## Troubleshooting

### Connection Failed

- Verify your site URL includes `https://` (if applicable) and has no trailing slash
- Ensure the username matches exactly (case-sensitive)
- Check that Application Passwords are enabled on your WordPress site
- Some security plugins may block REST API access - check your plugin settings

### Images Not Uploading

- Verify the image files exist in your vault
- Check that the images use supported formats (JPG, PNG, GIF, WebP, SVG)
- Ensure your WordPress user has media upload permissions

### Post Not Appearing

- Check if the post was created as a draft (look in **Posts > All Posts** and filter by status)
- Verify categories exist or check if they were created with correct names

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

If you find this plugin useful, consider:
- Starring the repository on GitHub
- Reporting bugs or suggesting features via GitHub Issues
- Contributing code improvements via Pull Requests

---

Made with <3 for the WordPress and Obsidian communities 
