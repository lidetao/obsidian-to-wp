import * as yaml from "js-yaml";
import type { PostFrontmatter, PostStatus } from "./types";

const VALID_STATUSES: PostStatus[] = ["draft", "publish", "private", "future"];

function toNonEmptyString(value: unknown): string | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}

	const str = String(value).trim();
	return str.length > 0 ? str : undefined;
}

function normalizeStringList(value: unknown): string[] | undefined {
	if (Array.isArray(value)) {
		const cleaned = value
			.map((item) => toNonEmptyString(item))
			.filter((item): item is string => Boolean(item));
		return cleaned.length > 0 ? cleaned : undefined;
	}

	const single = toNonEmptyString(value);
	return single ? [single] : undefined;
}

export function parseFrontmatter(content: string): PostFrontmatter {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

	if (!frontmatterMatch) {
		return {};
	}

	const yamlContent = frontmatterMatch[1];
	
	try {
		const parsed: unknown = yaml.load(yamlContent, { schema: yaml.JSON_SCHEMA });
		
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}

		const parsedFrontmatter = parsed as Record<string, unknown>;

		// 先整体保留所有字段，插件未识别的字段（series、digest、publish 等）
		// 会随 updateFrontmatter 原样写回，避免发布后被清空
		const result: PostFrontmatter = { ...parsedFrontmatter };

		if (parsedFrontmatter.title !== undefined) {
			result.title = String(parsedFrontmatter.title);
		}
		const slug = toNonEmptyString(parsedFrontmatter.slug);
		if (slug) {
			result.slug = slug;
		} else {
			delete result.slug;
		}
		if (parsedFrontmatter.status !== undefined) {
			// 原样保留；是否可用于发布由 getValidStatus() 判断
			result.status = String(parsedFrontmatter.status);
		}
		if (parsedFrontmatter.excerpt !== undefined) {
			result.excerpt = String(parsedFrontmatter.excerpt);
		}
		if (parsedFrontmatter.date !== undefined) {
			result.date = String(parsedFrontmatter.date);
		}
		if (parsedFrontmatter.wp_post_id !== undefined) {
			const id = typeof parsedFrontmatter.wp_post_id === "number"
				? parsedFrontmatter.wp_post_id
				: parseInt(String(parsedFrontmatter.wp_post_id), 10);
			if (!isNaN(id)) {
				result.wp_post_id = id;
			} else {
				delete result.wp_post_id;
			}
		}
		if (parsedFrontmatter.wp_post_url !== undefined) {
			result.wp_post_url = String(parsedFrontmatter.wp_post_url);
		}
		const categories = normalizeStringList(parsedFrontmatter.categories);
		if (categories) {
			result.categories = categories;
		} else {
			delete result.categories;
		}
		const tags = normalizeStringList(parsedFrontmatter.tags);
		if (tags) {
			result.tags = tags;
		} else {
			delete result.tags;
		}

		return result;
	} catch (error) {
		console.warn("Failed to parse frontmatter:", error);
		return {};
	}
}

export function updateFrontmatter(
	content: string,
	updates: Partial<PostFrontmatter>
): string {
	const hasFrontmatter = content.match(/^---\n[\s\S]*?\n---/);

	if (!hasFrontmatter) {
		const yaml = generateYaml(updates);
		return `---\n${yaml}---\n\n${content}`;
	}

	const existing = parseFrontmatter(content);
	const merged = { ...existing, ...updates };
	const yaml = generateYaml(merged);

	return content.replace(/^---\n[\s\S]*?\n---/, `---\n${yaml}---`);
}

function generateYaml(frontmatter: PostFrontmatter): string {
	const yamlObj: Record<string, unknown> = {};

	// 按原顺序输出全部字段，插件未识别的字段一并保留
	for (const [key, value] of Object.entries(frontmatter)) {
		if (value === undefined) {
			continue;
		}
		if ((key === "categories" || key === "tags") && Array.isArray(value) && value.length === 0) {
			continue;
		}
		yamlObj[key] = value;
	}

	try {
		return yaml.dump(yamlObj, {
			lineWidth: -1,
			noRefs: true,
			sortKeys: false,
			schema: yaml.JSON_SCHEMA,
		});
	} catch (error) {
		console.warn("Failed to generate YAML:", error);
		return "";
	}
}

/**
 * 去掉 frontmatter 块，只留正文部分。
 * 与 parseFrontmatter 使用同一条正则，保证两者对「什么是 frontmatter」的判断一致。
 */
export function stripFrontmatter(content: string): string {
	return content.replace(/^---\n[\s\S]*?\n---\n*/, "").trim();
}

/**
 * 按标记行切分正文：只保留标记行之后的内容。
 * 标记行留空或正文中找不到标记行时，原样返回（发布整篇）。
 */
export function applyPostFinalMarker(content: string, marker?: string): string {
	if (!marker) {
		return content;
	}

	const index = content.indexOf(marker);

	if (index === -1) {
		return content;
	}

	return content.slice(index + marker.length).trim();
}

/**
 * 返回可用于发布的 status；取值不在 WordPress 认可范围内时返回 undefined，
 * 由调用方回退到插件设置里的默认状态。
 */
export function getValidStatus(frontmatter: PostFrontmatter): PostStatus | undefined {
	const status = frontmatter.status;

	if (typeof status === "string" && VALID_STATUSES.includes(status as PostStatus)) {
		return status as PostStatus;
	}

	return undefined;
}

export function getTitle(frontmatter: PostFrontmatter, filename: string): string {
	if (frontmatter.title) {
		return frontmatter.title;
	}
	return filename.replace(/\.md$/, "");
}


