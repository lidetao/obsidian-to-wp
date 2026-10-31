import { App, TFile, Notice, normalizePath } from "obsidian";
import type { PluginSettings, PublishResult, UploadedImage, WordPressPostPayload, PostStatus } from "./types";
import { WordPressClient } from "./wordpress-client";
import { MarkdownConverter } from "./markdown-converter";
import {
	parseFrontmatter,
	updateFrontmatter,
	getTitle,
	getValidStatus,
	toNonEmptyString,
	stripFrontmatter,
	applyPostFinalMarker,
} from "./frontmatter";

/** MIME type mapping for common image extensions */
const MIME_TYPES: Record<string, string> = {
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
};


export class Publisher {
	private app: App;
	private getSettings: () => PluginSettings;
	private wordpressClient: WordPressClient;
	private markdownConverter: MarkdownConverter;

	constructor(
		app: App,
		getSettings: () => PluginSettings,
		wordpressClient: WordPressClient
	) {
		this.app = app;
		this.getSettings = getSettings;
		this.wordpressClient = wordpressClient;
		this.markdownConverter = new MarkdownConverter();
	}

	isPublishable(file: TFile): boolean {
		const settings = this.getSettings();
		
		if (!settings.publishableFolder) {
			return file.extension === "md";
		}

		const normalizedFolder = normalizePath(settings.publishableFolder);
		return file.extension === "md" && file.path.startsWith(normalizedFolder);
	}

	async publish(file: TFile, overrideStatus?: PostStatus): Promise<PublishResult> {
		const settings = this.getSettings();

		if (!settings.siteUrl || !settings.username || !settings.applicationPassword) {
			return {
				success: false,
				error: "WordPress connection not configured. Please check plugin settings.",
			};
		}

		if (!this.isPublishable(file)) {
			return {
				success: false,
				error: `File is not in the publishable folder: ${settings.publishableFolder}`,
			};
		}

		try {
			const content = await this.app.vault.read(file);
			const frontmatter = parseFrontmatter(content);

			// 去掉 frontmatter，再按标记行切分：之前的内容不进发布正文
			const body = applyPostFinalMarker(
				stripFrontmatter(content),
				settings.postFinalMarker
			);

			const imageMap = new Map<string, UploadedImage>();
			if (settings.uploadImages) {
				await this.uploadImages(file, body, imageMap);
			}

			this.markdownConverter.setImageMap(imageMap);
			const gutenbergContent = this.markdownConverter.convert(body);
			// frontmatter.status 可能是用户自定义的编辑状态，需校验后才用于发布
			const status: PostStatus = overrideStatus ?? getValidStatus(frontmatter) ?? settings.defaultPostStatus;

			const payload: WordPressPostPayload = {
				title: getTitle(frontmatter, file.basename),
				content: gutenbergContent,
				status,
			};

			if (frontmatter.slug && frontmatter.slug.trim().length > 0) {
				payload.slug = frontmatter.slug.trim();
			}
			// 摘要：excerpt 优先，留空则回退到 digest（一篇摘要服务 WP 与公众号两个通道）
			const excerpt = toNonEmptyString(frontmatter.excerpt) || toNonEmptyString(frontmatter.digest);
			if (excerpt) {
				payload.excerpt = excerpt;
			}
			if (frontmatter.date && status === "future") {
				payload.date = frontmatter.date;
			}

			// 特色图：取 frontmatter 的 image 字段（文件名或 wikilink）
			if (settings.uploadImages) {
				const featuredMediaId = await this.uploadFeaturedImage(
					file,
					frontmatter.image,
					imageMap
				);

				if (featuredMediaId !== undefined) {
					payload.featured_media = featuredMediaId;
				}
			}

			if (frontmatter.categories && frontmatter.categories.length > 0) {
				const categoryNames = frontmatter.categories.map((c) => String(c));
				payload.categories = await this.wordpressClient.resolveCategoryIds(categoryNames);
			}
			if (frontmatter.tags && frontmatter.tags.length > 0) {
				payload.tags = await this.wordpressClient.resolveTagIds(frontmatter.tags);
			}

			let post;
			if (frontmatter.wp_post_id) {
				post = await this.wordpressClient.updatePost(frontmatter.wp_post_id, payload);

				const updatedContent = updateFrontmatter(content, {
					wp_post_url: post.link,
					status: post.status,
				});
				await this.app.vault.modify(file, updatedContent);

				new Notice(`Updated post: ${post.title.rendered}`);
			} else {
				post = await this.wordpressClient.createPost(payload);
				
				const updatedContent = updateFrontmatter(content, {
					wp_post_id: post.id,
					wp_post_url: post.link,
					status: post.status,
				});
				await this.app.vault.modify(file, updatedContent);
				
				new Notice(`Published: ${post.title.rendered}`);
			}

			return {
				success: true,
				postId: post.id,
				postUrl: post.link,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			new Notice(`Publishing failed: ${message}`);
			return {
				success: false,
				error: message,
			};
		}
	}

	/** 上传 frontmatter image 指定的图片并设为特色图；正文里已上传过则复用，返回媒体库 ID */
	private async uploadFeaturedImage(
		file: TFile,
		imageField: unknown,
		imageMap: Map<string, UploadedImage>
	): Promise<number | undefined> {
		const raw = imageField === null || imageField === undefined
			? ""
			: String(imageField).trim();

		if (!raw) {
			return undefined;
		}

		const existing = imageMap.get(raw);

		if (existing) {
			return existing.mediaId;
		}

		try {
			const imagePath = this.resolveImagePath(file, raw);
			const imageFile = this.app.vault.getAbstractFileByPath(imagePath);

			if (!(imageFile instanceof TFile)) {
				console.warn(`Featured image not found: ${raw}`);
				return undefined;
			}

			const mimeType = MIME_TYPES[`.${imageFile.extension.toLowerCase()}`];

			if (!mimeType) {
				console.warn(`Unsupported featured image type: ${imageFile.extension}`);
				return undefined;
			}

			const data = await this.app.vault.readBinary(imageFile);
			const media = await this.wordpressClient.uploadMedia(
				imageFile.name,
				data,
				mimeType
			);

			return media.id;
		} catch (error) {
			console.warn(`Failed to upload featured image ${raw}:`, error);
			return undefined;
		}
	}

	private async uploadImages(
		file: TFile,
		content: string,
		imageMap: Map<string, UploadedImage>
	): Promise<void> {
		const imageRefs = this.markdownConverter.extractImageReferences(content);

		for (const ref of imageRefs) {
			try {
				if (ref.path.startsWith("http://") || ref.path.startsWith("https://")) {
					continue;
				}

				// Resolve the image file path relative to the note
				const imagePath = this.resolveImagePath(file, ref.path);
				const imageFile = this.app.vault.getAbstractFileByPath(imagePath);

				if (!(imageFile instanceof TFile)) {
					console.warn(`Image not found: ${ref.path}`);
					continue;
				}

				const ext = imageFile.extension.toLowerCase();
				const mimeType = MIME_TYPES[`.${ext}`];
				if (!mimeType) {
					console.warn(`Unsupported image type: ${ext}`);
					continue;
				}

				const data = await this.app.vault.readBinary(imageFile);
				const media = await this.wordpressClient.uploadMedia(
					imageFile.name,
					data,
					mimeType
				);

				imageMap.set(ref.path, {
					localPath: ref.path,
					wordpressUrl: media.source_url,
					mediaId: media.id,
				});
			} catch (error) {
				console.warn(`Failed to upload image ${ref.path}:`, error);
			}
		}
	}

	private resolveImagePath(file: TFile, imagePath: string): string {
		if (imagePath.startsWith("/")) {
			return normalizePath(imagePath.substring(1));
		}

		const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
			imagePath,
			file.path
		);

		if (linkedFile) {
			return linkedFile.path;
		}

		const noteFolder = file.parent?.path || "";
		return normalizePath(`${noteFolder}/${imagePath}`);
	}
}


