# Obsidian-to-WordPress: An Obsidian -> WordPress Publishing Plugin for WordPress

Publish your Obsidian notes directly to WordPress as Gutenberg block-formatted posts. This plugin converts Obsidian-flavored markdown (including callouts, wikilinks, and standard formatting) into WordPress block markup, handles image uploads to your WordPress media library, and authenticates securely using Application Passwords. Please note that this plugin is still under active development. Share any bugs you find via the Issues tab. 

## Currently Included Features

- **One-click publishing** - Publish notes via command palette or right-click context menu
- **Gutenberg block output** - Converts markdown to native WordPress block format
- **Image uploads** - Automatically uploads local images to WordPress media library; files already present under the same filename are reused rather than uploaded again (rename the file whenever you change an image's content)
- **Folder scoping** - Restrict publishing to notes in a specific folder
- **Frontmatter control** - Set post properties like title, slug, categories, tags, excerpt, and scheduled date
- **Post status control** - Publish as draft, published, private, or scheduled (per-post or default setting)
- **Update support** - Re-publish notes to update existing WordPress posts (_NOTE: still needs more testing! use with caution._)

## Installation

### Using BRAT (recommended for beta testing)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian Community Plugins
2. Open **Settings > BRAT > Add Beta plugin**
3. Enter the repository URL: `serabi/obsidian-to-wp`
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
| `status` | `draft`, `publish`, `private`, or `future` |
| `categories` | List of category names (created if they don't exist) |
| `tags` | List of tag names (created if they don't exist) |
| `excerpt` | Post excerpt/summary |
| `date` | Scheduled publish date (ISO 8601 format, requires `status: future`) |
| `wp_post_id` | WordPress post ID (auto-set after first publish) |

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

### Inline Formatting

- **Bold** (`**text**`)
- *Italic* (`*text*`)
- ~~Strikethrough~~ (`~~text~~`)
- `Inline code` (`` `code` ``)
- ==Highlights== (`==text==`)
- [Links](url) (`[text](url)`)
- Wikilinks are converted to plain text

## Roadmap

### Planned Features

- Featured image support
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
