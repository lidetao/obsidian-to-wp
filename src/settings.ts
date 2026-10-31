/**
 * Plugin settings interface, defaults, and settings tab
 */

import { App, PluginSettingTab, Setting, Notice, Modal, normalizePath, TFolder } from "obsidian";
import type ObsidianToWordPress from "./main";
import type { PluginSettings, PostStatus } from "./types";

/** Default plugin settings */
export const DEFAULT_SETTINGS: PluginSettings = {
	siteUrl: "",
	username: "",
	applicationPassword: "",
	publishableFolder: "",
	defaultPostStatus: "draft",
	uploadImages: true,
	postFinalMarker: "Post final :",
	createTemplate: false,
};

/** Settings tab UI for the plugin */
export class SettingsTab extends PluginSettingTab {
	plugin: ObsidianToWordPress;

	constructor(app: App, plugin: ObsidianToWordPress) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "WordPress connection" });

		new Setting(containerEl)
			.setName("Site URL")
			.setDesc("Your WordPress site URL (e.g., https://example.com)")
			.addText((text) =>
				text
					.setPlaceholder("https://example.com")
					.setValue(this.plugin.settings.siteUrl)
					.onChange(async (value) => {
						this.plugin.settings.siteUrl = value.replace(/\/+$/, "");
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Username")
			.setDesc("Your WordPress username")
			.addText((text) =>
				text
					.setPlaceholder("admin")
					.setValue(this.plugin.settings.username)
					.onChange(async (value) => {
						this.plugin.settings.username = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Application password")
			.setDesc(
				"Generate an Application Password in WordPress under Users > Profile > Application Passwords"
			)
			.addText((text) => {
				text
					.setPlaceholder("xxxx xxxx xxxx xxxx xxxx xxxx")
					.setValue(this.plugin.settings.applicationPassword)
					.onChange(async (value) => {
						this.plugin.settings.applicationPassword = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("Test connection")
			.setDesc("Verify your WordPress credentials are working")
			.addButton((button) =>
				button.setButtonText("Test").onClick(async () => {
					button.setDisabled(true);
					button.setButtonText("Testing...");
					try {
						const result = await this.plugin.wordpressClient.testConnection();
						if (result.success) {
							new Notice(`Connection successful! Logged in as: ${result.username}`);
						} else {
							new Notice(`Connection failed: ${result.error}`);
						}
					} catch (error) {
						new Notice(`Connection error: ${error instanceof Error ? error.message : "Unknown error"}`);
					} finally {
						button.setDisabled(false);
						button.setButtonText("Test");
					}
				})
			);

		containerEl.createEl("h2", { text: "Publishing options" });

		new Setting(containerEl)
			.setName("Publishable folder")
			.setDesc(
				"Only notes in this folder (and subfolders) can be published. Leave empty to allow all notes."
			)
			.addText((text) => {
				text
					.setPlaceholder("Blog/Posts")
					.setValue(this.plugin.settings.publishableFolder)
					.onChange(async (value) => {
						// Just update the input, don't save yet
					});
				text.inputEl.style.width = "200px";
			})
			.addButton((button) =>
				button.setButtonText("Browse").onClick(() => {
					new FolderPickerModal(this.app, async (folderPath: string) => {
						this.plugin.settings.publishableFolder = folderPath;
						await this.plugin.saveSettings();
						this.display(); // Refresh to show updated value
					}).open();
				})
			)
			.addButton((button) =>
				button.setButtonText("Save").onClick(async () => {
					const input = containerEl.querySelector(
						'.setting-item:has([placeholder="Blog/Posts"]) input'
					) as HTMLInputElement;
					if (input) {
						const folderPath = normalizePath(input.value.trim());

						if (folderPath) {
							const folder = this.app.vault.getAbstractFileByPath(folderPath);
							if (!folder) {
								const shouldCreate = confirm(`Folder "${folderPath}" doesn't exist. Create it?`);
								if (shouldCreate) {
									try {
										await this.app.vault.createFolder(folderPath);
										new Notice(`Created folder: ${folderPath}`);
									} catch (error) {
										new Notice(`Failed to create folder: ${error instanceof Error ? error.message : "Unknown error"}`);
										return;
									}
								} else {
									return;
								}
							}
						}

						this.plugin.settings.publishableFolder = folderPath;
						await this.plugin.saveSettings();
						new Notice(folderPath ? `Folder set: ${folderPath}` : "Folder cleared");

						if (folderPath && this.plugin.settings.createTemplate) {
							await this.createTemplateFile(folderPath);
						}
					}
				})
			);

		new Setting(containerEl)
			.setName("Create template file")
			.setDesc("Create a template file in the publishable folder that you can copy for new posts")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.createTemplate)
					.onChange(async (value) => {
					this.plugin.settings.createTemplate = value;
					await this.plugin.saveSettings();
					
					if (value && this.plugin.settings.publishableFolder) {
							await this.createTemplateFile(this.plugin.settings.publishableFolder);
						}
					})
			);

		new Setting(containerEl)
			.setName("Default post status")
			.setDesc("Default status for new posts (can be overridden per-post via frontmatter)")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("draft", "Draft")
					.addOption("publish", "Published")
					.addOption("private", "Private")
					.setValue(this.plugin.settings.defaultPostStatus)
					.onChange(async (value) => {
						this.plugin.settings.defaultPostStatus = value as PostStatus;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Upload images")
			.setDesc("Automatically upload local images to WordPress media library")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.uploadImages)
					.onChange(async (value) => {
						this.plugin.settings.uploadImages = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Post final marker")
			.setDesc(
				"Only content after this line is published. Leave empty to publish the whole note."
			)
			.addText((text) =>
				text
					.setPlaceholder("Post final :")
					.setValue(this.plugin.settings.postFinalMarker)
					.onChange(async (value) => {
						this.plugin.settings.postFinalMarker = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h2", { text: "Frontmatter reference" });

		const frontmatterDesc = containerEl.createEl("div", {
			cls: "setting-item-description",
		});
		frontmatterDesc.innerHTML = `
			<p>Use these frontmatter fields to control post properties:</p>
			<ul>
				<li><code>title</code> - Post title (defaults to note filename)</li>
				<li><code>slug</code> - URL slug/permalink</li>
				<li><code>status</code> - Post status: draft, publish, private, or future</li>
				<li><code>categories</code> - List of category names</li>
				<li><code>tags</code> - List of tag names</li>
				<li><code>excerpt</code> - Post excerpt/summary</li>
				<li><code>date</code> - Scheduled publish date (ISO 8601, e.g., YYYY-MM-DDTHH:MM:SS)</li>
				<li><code>wp_post_id</code> - WordPress post ID (auto-set after first publish)</li>
				<li><code>wp_post_url</code> - WordPress post URL (auto-set after publishing)</li>
			</ul>
			<p>Example:</p>
			<pre>---
title: My Blog Post
slug: my-blog-post
status: draft
categories:
  - Technology
  - Tutorials
tags:
  - obsidian
  - wordpress
excerpt: A short summary of my post
---</pre>
		`;
	}

	private async createTemplateFile(folderPath: string): Promise<void> {
		const templatePath = normalizePath(`${folderPath}/Template.md`);
		
		const existingFile = this.app.vault.getAbstractFileByPath(templatePath);
		if (existingFile) {
			return;
		}

		const templateContent = `---
title: Post Title
slug: post-slug
status: draft
categories:
  - Category 1
tags:
  - tag1
  - tag2
excerpt: A brief summary of your post
---

# Your Post Title

Write your content here.

## Section Heading

Your content goes here.
`;

		try {
			await this.app.vault.create(templatePath, templateContent);
			new Notice(`Template created: ${templatePath}`);
		} catch (error) {
			new Notice(`Failed to create template: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}
}

class FolderPickerModal extends Modal {
	private onSelect: (folderPath: string) => void;

	constructor(app: App, onSelect: (folderPath: string) => void) {
		super(app);
		this.onSelect = onSelect;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Select folder" });

		const inputEl = contentEl.createEl("input", {
			type: "text",
			placeholder: "Enter folder path (e.g., Blog/Posts)",
			cls: "folder-picker-input",
		});
		inputEl.style.width = "100%";
		inputEl.style.marginBottom = "1em";

		const folders: TFolder[] = [];
		this.app.vault.getAllLoadedFiles().forEach((fileOrFolder) => {
			if (fileOrFolder instanceof TFolder) {
				folders.push(fileOrFolder);
			}
		});

		const folderList = contentEl.createEl("div", { cls: "folder-list" });
		folderList.style.maxHeight = "300px";
		folderList.style.overflowY = "auto";
		folderList.style.marginBottom = "1em";

		const renderFolders = (filter: string = "") => {
			folderList.empty();
			
			const filtered = folders.filter((folder) =>
				folder.path.toLowerCase().includes(filter.toLowerCase())
			);

			if (filtered.length === 0) {
				folderList.createEl("div", {
					text: "No folders found",
					cls: "folder-item",
				});
				return;
			}

			filtered.forEach((folder) => {
				const item = folderList.createEl("div", {
					text: folder.path,
					cls: "folder-item",
				});
				item.style.padding = "0.5em";
				item.style.cursor = "pointer";
				item.style.borderBottom = "1px solid var(--background-modifier-border)";

				item.addEventListener("click", () => {
					inputEl.value = folder.path;
				});

				item.addEventListener("mouseenter", () => {
					item.style.backgroundColor = "var(--background-modifier-hover)";
				});

				item.addEventListener("mouseleave", () => {
					item.style.backgroundColor = "transparent";
				});
			});
		};

		inputEl.addEventListener("input", (e) => {
			const value = (e.target as HTMLInputElement).value;
			renderFolders(value);
		});

		renderFolders();

		const buttonContainer = contentEl.createEl("div", { cls: "folder-picker-buttons" });
		buttonContainer.style.display = "flex";
		buttonContainer.style.gap = "0.5em";
		buttonContainer.style.justifyContent = "flex-end";

		const selectButton = buttonContainer.createEl("button", {
			text: "Select",
			cls: "mod-cta",
		});

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});

		selectButton.addEventListener("click", () => {
			const path = inputEl.value.trim();
			this.onSelect(path);
			this.close();
		});

		cancelButton.addEventListener("click", () => {
			this.close();
		});

		inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				selectButton.click();
			}
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}


