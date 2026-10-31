import { requestUrl, RequestUrlParam } from "obsidian";
import type {
	PluginSettings,
	WordPressPost,
	WordPressPostPayload,
	WordPressMedia,
	WordPressTerm,
	WordPressError,
} from "./types";

/** Result of connection test */
export interface ConnectionTestResult {
	success: boolean;
	username?: string;
	error?: string;
}

/** 取 URL 的最后一段作为文件名，兼容带 query string 与 URL 编码的情况 */
function mediaBasename(sourceUrl: string): string {
	const withoutQuery = sourceUrl.split("?")[0].split("#")[0];
	const parts = withoutQuery.split("/");

	try {
		return decodeURIComponent(parts[parts.length - 1] ?? "");
	} catch {
		return parts[parts.length - 1] ?? "";
	}
}

export class WordPressClient {
	private getSettings: () => PluginSettings;

	constructor(getSettings: () => PluginSettings) {
		this.getSettings = getSettings;
	}

	private get apiBase(): string {
		const settings = this.getSettings();
		return `${settings.siteUrl}/wp-json/wp/v2`;
	}

	private get authHeader(): string {
		const settings = this.getSettings();
		const credentials = `${settings.username}:${settings.applicationPassword}`;
		return `Basic ${btoa(credentials)}`;
	}

	private async request<T>(
		endpoint: string,
		options: Partial<RequestUrlParam> = {}
	): Promise<T> {
		const settings = this.getSettings();
		
		if (!settings.siteUrl || !settings.username || !settings.applicationPassword) {
			throw new Error("WordPress connection not configured. Please check plugin settings.");
		}

		const url = endpoint.startsWith("http") ? endpoint : `${this.apiBase}${endpoint}`;

		const response = await requestUrl({
			url,
			method: options.method || "GET",
			headers: {
				Authorization: this.authHeader,
				"Content-Type": "application/json",
				...options.headers,
			},
			body: options.body,
			throw: false,
		});

		if (response.status >= 400) {
			const error = response.json as WordPressError;
			throw new Error(error?.message || `HTTP ${response.status}: Request failed`);
		}

		return response.json as T;
	}

	async testConnection(): Promise<ConnectionTestResult> {
		try {
			const user = await this.request<{ name: string }>("/users/me");
			return {
				success: true,
				username: user.name,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async createPost(payload: WordPressPostPayload): Promise<WordPressPost> {
		return this.request<WordPressPost>("/posts", {
			method: "POST",
			body: JSON.stringify(payload),
		});
	}

	async updatePost(postId: number, payload: WordPressPostPayload): Promise<WordPressPost> {
		return this.request<WordPressPost>(`/posts/${postId}`, {
			method: "PUT",
			body: JSON.stringify(payload),
		});
	}

	async getPost(postId: number): Promise<WordPressPost | null> {
		try {
			return await this.request<WordPressPost>(`/posts/${postId}`);
		} catch {
			return null;
		}
	}

	/**
 * 按文件名在媒体库里查找已存在的图片，命中则返回媒体条目，否则返回 null。
 *
 * WordPress 的 `search` 只能匹配 attachment 的标题/描述，且标题可能被改过，
 * 所以取回候选后必须按 source_url 的实际文件名精确比对，避免误命中同前缀的图。
 * 找不到就返回 null，调用方照常上传新副本。
 */
async findMediaByFilename(filename: string): Promise<WordPressMedia | null> {
	const query = filename.replace(/\.[^.]+$/, "");

	if (!query) {
		return null;
	}

	const candidates = await this.request<WordPressMedia[]>(
		`/media?search=${encodeURIComponent(query)}&per_page=100&_fields=id,source_url,mime_type`
	);

	if (!Array.isArray(candidates)) {
		return null;
	}

	const target = filename.toLowerCase();

	return (
		candidates.find(
			(media) => mediaBasename(media.source_url).toLowerCase() === target
		) ?? null
	);
}

async uploadMedia(
		filename: string,
		data: ArrayBuffer,
		mimeType: string
	): Promise<WordPressMedia> {
		const url = `${this.apiBase}/media`;

		const response = await requestUrl({
			url,
			method: "POST",
			headers: {
				Authorization: this.authHeader,
				"Content-Type": mimeType,
				"Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
			},
			body: data,
			throw: false,
		});

		if (response.status >= 400) {
			const error = response.json as WordPressError;
			throw new Error(error?.message || `Failed to upload media: HTTP ${response.status}`);
		}

		return response.json as WordPressMedia;
	}

	async getOrCreateCategory(name: string): Promise<number> {
		const existing = await this.request<WordPressTerm[]>(
			`/categories?search=${encodeURIComponent(name)}&per_page=100`
		);

		const match = existing.find(
			(cat) => cat.name.toLowerCase() === name.toLowerCase()
		);
		if (match) {
			return match.id;
		}

		const created = await this.request<WordPressTerm>("/categories", {
			method: "POST",
			body: JSON.stringify({ name }),
		});

		return created.id;
	}

	async getOrCreateTag(name: string): Promise<number> {
		const existing = await this.request<WordPressTerm[]>(
			`/tags?search=${encodeURIComponent(name)}&per_page=100`
		);

		const match = existing.find(
			(tag) => tag.name.toLowerCase() === name.toLowerCase()
		);
		if (match) {
			return match.id;
		}

		const created = await this.request<WordPressTerm>("/tags", {
			method: "POST",
			body: JSON.stringify({ name }),
		});

		return created.id;
	}

	async resolveCategoryIds(names: string[]): Promise<number[]> {
		const ids: number[] = [];
		for (const name of names) {
			try {
				const id = await this.getOrCreateCategory(name);
				ids.push(id);
			} catch (error) {
				console.warn(`Failed to resolve category "${name}":`, error);
			}
		}
		return ids;
	}

	async resolveTagIds(names: string[]): Promise<number[]> {
		const ids: number[] = [];
		for (const name of names) {
			try {
				const id = await this.getOrCreateTag(name);
				ids.push(id);
			} catch (error) {
				console.warn(`Failed to resolve tag "${name}":`, error);
			}
		}
		return ids;
	}
}


