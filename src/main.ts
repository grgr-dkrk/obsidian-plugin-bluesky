import {
  App,
  Editor,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";
import { BskyAgent } from "@atproto/api";

type BlueskyPluginSettings = {
  identifier: string;
  appPassword: string;
};

const DEFAULT_SETTINGS: BlueskyPluginSettings = {
  identifier: ".bsky.social",
  appPassword: "",
};

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  const hour = ("0" + date.getHours()).slice(-2);
  const minute = ("0" + date.getMinutes()).slice(-2);
  const second = ("0" + date.getSeconds()).slice(-2);
  return `${year}-${month}-${day}-${hour}-${minute}-${second}`;
};

export default class BlueskyPlugin extends Plugin {
  settings: BlueskyPluginSettings;
  agent: BskyAgent;
  appPassword: string | null;

  private __handleInfoMessage(message: string) {
    new Notice(`Obsidian Bluesky Plugin: ${message}`);
  }

  private __checkAuthenticated() {
    if (!this.agent.hasSession) {
      this.__handleInfoMessage("(Error) not authenticated");
      return false;
    }
    return true;
  }

  private __login() {
    if (!this.settings.identifier || !this.appPassword) {
      this.__handleInfoMessage("identifier or appPassword must be exist");
      return;
    }
    if (this.agent.hasSession) {
      this.__handleInfoMessage("you are already logged in");
      return;
    }
    this.agent
      .login({
        identifier: this.settings.identifier,
        password: this.appPassword,
      })
      .then(() => {
        this.__handleInfoMessage("login succeed");
      })
      .catch((error) => {
        console.error(error);
        this.__handleInfoMessage("login failed");
      });
  }

  private async postOfSelection(text: string | null) {
    if (!this.__checkAuthenticated()) {
      return;
    }
    if (!text || ![...text].length) {
      this.__handleInfoMessage("texts are not selected");
      return;
    }

    this.agent
      .post({
        $type: "app.bsky.feed.post",
        text,
        facets: [],
      })
      .then(() => {
        this.__handleInfoMessage("Post message succeeded");
      })
      .catch((error) => {
        console.error(error);
        this.__handleInfoMessage("Failed to post");
      });
  }

  async onload() {
    await this.loadSettings();
    this.agent = new BskyAgent({ service: "https://bsky.social" });
    this.addSettingTab(new SampleSettingTab(this.app, this));
    // @ts-ignore
    this.appPassword = this.app.loadLocalStorage("appPassword");

    if (this.settings.identifier && this.appPassword) {
      this.__login();
    }

    /**
     * Commands
     */

    /**
     * Login
     */
    this.addCommand({
      id: "login",
      name: "Login",
      callback: () => {
        this.__login();
      },
    });

    /**
     * Post Selection Text
     */
    this.addCommand({
      id: "post-selection-text",
      name: "Post selection text",
      editorCallback: (editor: Editor) => {
        this.postOfSelection(editor.getSelection());
      },
    });

    this.addCommand({
      id: "init-appPassword",
      name: "Initialize app password",
      callback: () => {
        // @ts-ignore
        this.appPassword = this.app.saveLocalStorage("appPassword", null);
      },
    });

    this.addCommand({
      id: "get-timeline-unstable",
      name: "Add Page of Timeline(experimental)",
      callback: async () => {
        const response = await this.agent.getTimeline({
          limit: 10,
        });
        if (!response.success) {
          return this.__handleInfoMessage("Failed to get Timeline");
        }
        const feeds = response.data.feed.map((feed) => {
          //@ts-ignore
          return feed.post.record?.text;
        });
        await this.app.vault.create(
          `timeline_${formatDate(new Date())}.md`,
          feeds.join(`\n`),
        );
      },
    });

    /**
     * Events
     */
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu) => {
        menu.addItem((item) => {
          item.setTitle("Post selection to Bluesky").onClick(() => {
            this.postOfSelection(getSelection()?.toString() ?? null);
          });
        });
      }),
    );
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleSettingTab extends PluginSettingTab {
  plugin: BlueskyPlugin;

  constructor(app: App, plugin: BlueskyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Settings for my awesome plugin." });

    new Setting(containerEl)
      .setName("Identity")
      .setDesc("Enter your domain name (ex: alice.bsky.social)")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.identifier)
          .onChange(async (value) => {
            this.plugin.settings.identifier = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("App password")
      .setDesc(
        `Enter your App password, please be careful when using it. Do not set account password. This value will be stored in localstorage instead of this settings, so please be careful when using it. When clearing, execute the "Initialize app password" command.`,
      )
      .addText((text) =>
        text.onChange(async (value) => {
          // @ts-ignore
          this.app.saveLocalStorage("appPassword", value);
        }),
      );
  }
}
