/**
 * TypeScript interfaces and types for the Obsidian to WordPress plugin
 */

/** WordPress post status options */
export type PostStatus = "draft" | "publish" | "private" | "future";

/** Plugin settings stored in Obsidian */
export interface PluginSettings {
	/** WordPress site URL (e.g., https://example.com) */
	siteUrl: string;
	/** WordPress username */
	username: string;
	/** WordPress Application Password */
	applicationPassword: string;
	/** Folder path to scope publishable notes (empty = all notes) */
	publishableFolder: string;
	/** Default post status when publishing */
	defaultPostStatus: PostStatus;
	/** Whether to upload images to WordPress media library */
	uploadImages: boolean;
	/**
	 * 标记行：只有它之后的内容才会发布，之前的内容（素材、TODO、提纲）不会进正文。
	 * 留空表示发布整篇笔记。
	 */
	postFinalMarker: string;
	/** Whether to create a template file in the publishable folder */
	createTemplate: boolean;
}

/** Frontmatter fields that map to WordPress post properties */
export interface PostFrontmatter {
	/** Post title (overrides note title) */
	title?: string;
	/** Post slug/permalink */
	slug?: string;
	/**
	 * Post status (overrides default).
	 * 原样保留任意取值（包括插件不识别的编辑状态），
	 * 但只有 WordPress 认可的取值才会真正用于发布，
	 * 判断见 frontmatter.ts 的 getValidStatus()。
	 */
	status?: string;
	/** Category names or IDs */
	categories?: string[] | number[];
	/** Tag names */
	tags?: string[];
	/** Post excerpt */
	excerpt?: string;
	/** Scheduled publish date (ISO 8601 format) */
	date?: string;
	/** WordPress post ID (set after first publish for updates) */
	wp_post_id?: number;
	/** WordPress post URL (set after publishing) */
	wp_post_url?: string;
	/**
	 * 插件未识别的其他字段（如 series、digest、publish 等）。
	 * 发布时会原样写回笔记，不会被删除。
	 */
	[key: string]: unknown;
}

/** WordPress REST API post creation/update payload */
export interface WordPressPostPayload {
	title: string;
	content: string;
	status: PostStatus;
	slug?: string;
	categories?: number[];
	tags?: number[];
	excerpt?: string;
	date?: string;
	/** 特色图（Featured Image）的媒体库 ID，取自 frontmatter 的 image 字段 */
	featured_media?: number;
}

/** WordPress REST API post response */
export interface WordPressPost {
	id: number;
	link: string;
	status: PostStatus;
	title: {
		rendered: string;
	};
	slug: string;
}

/** WordPress REST API media upload response */
export interface WordPressMedia {
	id: number;
	source_url: string;
	mime_type?: string;
	media_details?: {
		width: number;
		height: number;
	};
}

/** WordPress REST API category/tag response */
export interface WordPressTerm {
	id: number;
	name: string;
	slug: string;
}

/** WordPress REST API error response */
export interface WordPressError {
	code: string;
	message: string;
	data?: {
		status: number;
	};
}

/** Result of publishing a note */
export interface PublishResult {
	success: boolean;
	postId?: number;
	postUrl?: string;
	error?: string;
}

/** Image reference found in markdown */
export interface ImageReference {
	/** Original markdown syntax (e.g., ![alt](path) or ![[wikilink]]) */
	originalSyntax: string;
	/** Path to the image file */
	path: string;
	/** Alt text if provided */
	altText: string;
	/** Whether this is a wikilink style embed */
	isWikilink: boolean;
}

/** Uploaded image mapping */
export interface UploadedImage {
	/** Local path to the image */
	localPath: string;
	/** WordPress media URL after upload */
	wordpressUrl: string;
	/** WordPress media ID */
	mediaId: number;
}

/** Callout type mapping to styling */
export interface CalloutInfo {
	type: string;
	title: string;
	content: string;
	foldable: boolean;
	defaultFolded: boolean;
}


