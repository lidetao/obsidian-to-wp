/**
 * Converts Obsidian-flavored markdown to WordPress Gutenberg block markup
 */

import type { ImageReference, CalloutInfo, UploadedImage } from "./types";

export class MarkdownConverter {
	private imageMap: Map<string, UploadedImage> = new Map();

	setImageMap(map: Map<string, UploadedImage>): void {
		this.imageMap = map;
	}

	convert(markdown: string): string {
		const content = this.removeFrontmatter(markdown);

		const blocks = this.splitIntoBlocks(content);
		const gutenbergBlocks = blocks.map((block) => this.convertBlock(block));

		return gutenbergBlocks.join("\n\n");
	}

	private removeFrontmatter(content: string): string {
		const frontmatterRegex = /^---\n[\s\S]*?\n---\n*/;
		return content.replace(frontmatterRegex, "").trim();
	}

	private splitIntoBlocks(content: string): string[] {
		const blocks: string[] = [];
		const lines = content.split("\n");
		let currentBlock: string[] = [];
		let inCodeBlock = false;
		let inCallout = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line.startsWith("```")) {
				if (inCodeBlock) {
					currentBlock.push(line);
					blocks.push(currentBlock.join("\n"));
					currentBlock = [];
					inCodeBlock = false;
				} else {
					if (currentBlock.length > 0) {
						blocks.push(currentBlock.join("\n"));
						currentBlock = [];
					}
					currentBlock.push(line);
					inCodeBlock = true;
				}
				continue;
			}

			if (inCodeBlock) {
				currentBlock.push(line);
				continue;
			}

			if (line.match(/^>\s*\[!/)) {
				if (currentBlock.length > 0) {
					blocks.push(currentBlock.join("\n"));
					currentBlock = [];
				}
				inCallout = true;
				currentBlock.push(line);
				continue;
			}

			if (inCallout) {
				if (line.startsWith(">") || line.trim() === "") {
					currentBlock.push(line);
					continue;
				} else {
					blocks.push(currentBlock.join("\n"));
					currentBlock = [];
					inCallout = false;
				}
			}

			if (line.match(/^#{1,6}\s/)) {
				if (currentBlock.length > 0) {
					blocks.push(currentBlock.join("\n"));
					currentBlock = [];
				}
				blocks.push(line);
				continue;
			}

			if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
				if (currentBlock.length > 0) {
					blocks.push(currentBlock.join("\n"));
					currentBlock = [];
				}
				blocks.push(line);
				continue;
			}

			if (line.match(/^(\s*[-*+]|\s*\d+\.)\s/)) {
				if (currentBlock.length > 0 && !currentBlock[0].match(/^(\s*[-*+]|\s*\d+\.)\s/)) {
					blocks.push(currentBlock.join("\n"));
					currentBlock = [];
				}
				currentBlock.push(line);
				continue;
			}

			if (line.startsWith(">") && !line.match(/^>\s*\[!/)) {
				if (currentBlock.length > 0 && !currentBlock[0].startsWith(">")) {
					blocks.push(currentBlock.join("\n"));
					currentBlock = [];
				}
				currentBlock.push(line);
				continue;
			}

			if (line.match(/^!\[.*?\]\(.*?\)$/) || line.match(/^!\[\[.*?\]\]$/)) {
				if (currentBlock.length > 0) {
					blocks.push(currentBlock.join("\n"));
					currentBlock = [];
				}
				blocks.push(line);
				continue;
			}

			if (line.trim() === "") {
				if (currentBlock.length > 0) {
					blocks.push(currentBlock.join("\n"));
					currentBlock = [];
				}
				continue;
			}

			currentBlock.push(line);
		}

		if (currentBlock.length > 0) {
			blocks.push(currentBlock.join("\n"));
		}

		return blocks.filter((b) => b.trim() !== "");
	}

	private convertBlock(block: string): string {
		const trimmed = block.trim();

		const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
		if (headerMatch) {
			const level = headerMatch[1].length;
			const text = this.convertInlineFormatting(headerMatch[2]);
			return `<!-- wp:heading {"level":${level}} -->\n<h${level}>${text}</h${level}>\n<!-- /wp:heading -->`;
		}

		if (trimmed.startsWith("```")) {
			return this.convertCodeBlock(trimmed);
		}

		if (trimmed.match(/^>\s*\[!/)) {
			return this.convertCallout(trimmed);
		}

		if (trimmed.startsWith(">")) {
			return this.convertBlockquote(trimmed);
		}

		if (trimmed.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
			return "<!-- wp:separator -->\n<hr class=\"wp-block-separator has-alpha-channel-opacity\"/>\n<!-- /wp:separator -->";
		}

		if (trimmed.match(/^\d+\.\s/)) {
			return this.convertOrderedList(trimmed);
		}

		if (trimmed.match(/^[-*+]\s/)) {
			return this.convertUnorderedList(trimmed);
		}

		if (trimmed.match(/^!\[.*?\]\(.*?\)$/) || trimmed.match(/^!\[\[.*?\]\]$/)) {
			return this.convertImage(trimmed);
		}

		return this.convertParagraph(trimmed);
	}

	/** Convert a code block */
	private convertCodeBlock(block: string): string {
		const lines = block.split("\n");
		const firstLine = lines[0];
		const language = firstLine.replace(/^```/, "").trim() || "";
		const code = lines.slice(1, -1).join("\n");
		const escapedCode = this.escapeHtml(code);

		if (language) {
			return `<!-- wp:code -->\n<pre class="wp-block-code"><code class="language-${language}">${escapedCode}</code></pre>\n<!-- /wp:code -->`;
		}
		return `<!-- wp:code -->\n<pre class="wp-block-code"><code>${escapedCode}</code></pre>\n<!-- /wp:code -->`;
	}

	private convertCallout(block: string): string {
		const calloutInfo = this.parseCallout(block);
		const contentHtml = this.convertInlineFormatting(calloutInfo.content);
		const typeClass = `callout-${calloutInfo.type.toLowerCase()}`;
		
		return `<!-- wp:quote {"className":"${typeClass}"} -->
<blockquote class="wp-block-quote ${typeClass}"><p><strong>${this.escapeHtml(calloutInfo.title)}</strong></p><p>${contentHtml}</p></blockquote>
<!-- /wp:quote -->`;
	}

	/** Parse callout syntax into structured data */
	private parseCallout(block: string): CalloutInfo {
		const lines = block.split("\n");
		const firstLine = lines[0];
		const headerMatch = firstLine.match(/^>\s*\[!(\w+)\]([-+])?\s*(.*)$/);
		
		let type = "note";
		let title = "";
		let foldable = false;
		let defaultFolded = false;

		if (headerMatch) {
			type = headerMatch[1];
			if (headerMatch[2] === "+") {
				foldable = true;
				defaultFolded = false;
			} else if (headerMatch[2] === "-") {
				foldable = true;
				defaultFolded = true;
			}
			title = headerMatch[3] || type.charAt(0).toUpperCase() + type.slice(1);
		}

		const content = lines
			.slice(1)
			.map((line) => line.replace(/^>\s?/, ""))
			.join("\n")
			.trim();

		return { type, title, content, foldable, defaultFolded };
	}

	private convertBlockquote(block: string): string {
		const content = block
			.split("\n")
			.map((line) => line.replace(/^>\s?/, ""))
			.join("\n");
		const html = this.convertInlineFormatting(content);
		return `<!-- wp:quote -->\n<blockquote class="wp-block-quote"><p>${html}</p></blockquote>\n<!-- /wp:quote -->`;
	}

	private convertUnorderedList(block: string): string {
		const items = this.parseListItems(block, /^[-*+]\s/);
		const listHtml = items.map((item) => `<li>${this.convertInlineFormatting(item)}</li>`).join("");
		return `<!-- wp:list -->\n<ul class="wp-block-list">${listHtml}</ul>\n<!-- /wp:list -->`;
	}

	private convertOrderedList(block: string): string {
		const items = this.parseListItems(block, /^\d+\.\s/);
		const listHtml = items.map((item) => `<li>${this.convertInlineFormatting(item)}</li>`).join("");
		return `<!-- wp:list {"ordered":true} -->\n<ol class="wp-block-list">${listHtml}</ol>\n<!-- /wp:list -->`;
	}

	private parseListItems(block: string, pattern: RegExp): string[] {
		const lines = block.split("\n");
		const items: string[] = [];
		let currentItem = "";

		for (const line of lines) {
			if (line.match(pattern)) {
				if (currentItem) {
					items.push(currentItem);
				}
				currentItem = line.replace(pattern, "");
			} else if (line.match(/^\s+/) && currentItem) {
				currentItem += " " + line.trim();
			}
		}

		if (currentItem) {
			items.push(currentItem);
		}

		return items;
	}

	private convertImage(block: string): string {
		const imageRef = this.extractImageReference(block);
		if (!imageRef) {
			return this.convertParagraph(block);
		}

		const uploaded = this.imageMap.get(imageRef.path);
		const url = uploaded?.wordpressUrl || imageRef.path;
		const alt = this.escapeHtml(imageRef.altText);

		return `<!-- wp:image -->\n<figure class="wp-block-image"><img src="${url}" alt="${alt}"/></figure>\n<!-- /wp:image -->`;
	}

	private convertParagraph(block: string): string {
		const html = this.convertInlineFormatting(block);
		return `<!-- wp:paragraph -->\n<p>${html}</p>\n<!-- /wp:paragraph -->`;
	}

	private convertInlineFormatting(text: string): string {
		// 先转义 HTML 特殊字符再套行内标记：正文/行内代码里出现的 <p>、<!-- 等
		// 必须按字面展示，绝不允许混进 Gutenberg 的 HTML 结构里
		let result = this.escapeHtml(text);

		result = result.replace(/!\[\[([^\]]+)\]\]/g, (match, path) => {
			const uploaded = this.imageMap.get(path);
			const url = uploaded?.wordpressUrl || path;
			return `<img src="${url}" alt="${path}"/>`;
		});

		result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, path) => {
			const uploaded = this.imageMap.get(path);
			const url = uploaded?.wordpressUrl || path;
			return `<img src="${url}" alt="${alt}"/>`;
		});

		result = result.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
		result = result.replace(/\[\[([^\]]+)\]\]/g, "$1");

		result = result.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
		result = result.replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>");

		result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
		result = result.replace(/__([^_]+)__/g, "<strong>$1</strong>");

		result = result.replace(/\*([^*]+)\*/g, "<em>$1</em>");
		result = result.replace(/(?<![a-zA-Z])_([^_]+)_(?![a-zA-Z])/g, "<em>$1</em>");

		result = result.replace(/~~([^~]+)~~/g, "<del>$1</del>");

		result = result.replace(/`([^`]+)`/g, "<code>$1</code>");

		result = result.replace(/==([^=]+)==/g, "<mark>$1</mark>");

		result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

		return result;
	}

	extractImageReferences(markdown: string): ImageReference[] {
		const images: ImageReference[] = [];
		const content = this.removeFrontmatter(markdown);

		const standardRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
		let match;
		while ((match = standardRegex.exec(content)) !== null) {
			images.push({
				originalSyntax: match[0],
				altText: match[1],
				path: match[2],
				isWikilink: false,
			});
		}

		const wikilinkRegex = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
		while ((match = wikilinkRegex.exec(content)) !== null) {
			images.push({
				originalSyntax: match[0],
				path: match[1],
				altText: match[2] || match[1],
				isWikilink: true,
			});
		}

		return images;
	}

	private extractImageReference(block: string): ImageReference | null {
		const standardMatch = block.match(/!\[([^\]]*)\]\(([^)]+)\)/);
		if (standardMatch) {
			return {
				originalSyntax: standardMatch[0],
				altText: standardMatch[1],
				path: standardMatch[2],
				isWikilink: false,
			};
		}

		const wikilinkMatch = block.match(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
		if (wikilinkMatch) {
			return {
				originalSyntax: wikilinkMatch[0],
				path: wikilinkMatch[1],
				altText: wikilinkMatch[2] || wikilinkMatch[1],
				isWikilink: true,
			};
		}

		return null;
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
}


