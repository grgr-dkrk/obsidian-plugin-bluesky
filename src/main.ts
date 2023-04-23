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
        if (!this.__checkAuthenticated()) {
          return;
        }
        const text = editor.getSelection();
        if (![...text].length) {
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
