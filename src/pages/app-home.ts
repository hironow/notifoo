import { LitElement, css, html } from "lit";
import { property, customElement } from "lit/decorators.js";
import { resolveRouterPath } from "../router";

import "@awesome.me/webawesome/dist/components/card/card.js";
import "@awesome.me/webawesome/dist/components/button/button.js";

import { styles } from "../styles/shared-styles";

@customElement("app-home")
export class AppHome extends LitElement {
  @property() message = "Welcome!";
  private deferredPrompt: any;

  static styles = [
    styles,
    css`
      #welcomeBar {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
      }

      #welcomeCard,
      #infoCard {
        padding: 18px;
        padding-top: 0px;
      }

      wa-card::part(footer) {
        display: flex;
        justify-content: flex-end;
      }

      @media (min-width: 750px) {
        wa-card {
          width: 70vw;
        }
      }

      @media (horizontal-viewport-segments: 2) {
        #welcomeBar {
          flex-direction: row;
          align-items: flex-start;
          justify-content: space-between;
        }

        #welcomeCard {
          margin-right: 64px;
        }
      }

      #installButton,
      #allowNotificationsButton {
        display: none;
        margin-top: 20px;
      }
    `,
  ];

  async firstUpdated() {
    console.log("This is your home page");

    // Service Worker は index.html で登録済み。ここでは ready を待って利用する
    if ("serviceWorker" in navigator && "PushManager" in window) {
      try {
        const registration = await navigator.serviceWorker.ready;

        // beforeinstallprompt イベントをリッスンして、インストールボタンを表示
        window.addEventListener("beforeinstallprompt", (e) => {
          e.preventDefault(); // デフォルトのプロンプトをキャンセル
          this.deferredPrompt = e; // プロンプトイベントを保存

          // TODO: ボタンが表示されたりされなかったりするので、修正が必要

          // インストールボタンを表示
          const installButton = this.shadowRoot!.getElementById("installButton");
          if (installButton) {
            installButton.style.display = "block"; // ボタンを表示
            installButton.addEventListener("click", () => {
              void this.showInstallPrompt();
            });
          }
        });

        // 通知許可ボタンを表示
        // TODO: すでに許可されている場合は表示しない
        const allowNotificationsButton = this.shadowRoot!.getElementById(
          "allowNotificationsButton",
        );
        if (allowNotificationsButton) {
          allowNotificationsButton.style.display = "block"; // ボタンを表示
          allowNotificationsButton.addEventListener("click", () => {
            void this.requestPushNotification(registration);
          });
        }
      } catch (error) {
        console.error("Service Workerの登録に失敗しました:", error);
      }
    }
  }

  async showInstallPrompt() {
    try {
      // インストールプロンプトを表示
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`ユーザーのインストール結果: ${outcome}`);
        this.deferredPrompt = null; // プロンプトをリセット
      }
    } catch (error) {
      console.error("インストールプロンプトの表示中にエラーが発生しました:", error);
    }
  }

  // Push通知の許可リクエストとサブスクリプションを分けて実行
  async requestPushNotification(registration: ServiceWorkerRegistration) {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        console.log("通知が許可されました");
        await this.subscribeUserToPush(registration); // Push通知のサブスクリプション
      } else {
        console.log("通知が拒否されました");
      }
    } catch (error) {
      console.error("通知許可リクエスト中にエラーが発生しました:", error);
    }
  }

  async subscribeUserToPush(registration: ServiceWorkerRegistration) {
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
          "BN3s0j8LE0zvKDyrKI4ixxT8Wd90kPPfqA6PwtQZ-BNhfjtgfUcWAWrdc1QoXOK0SBFBgvLdtXz32NyP0GNxozY", // VAPIDキーを追加
      });
      console.log("Push通知にサブスクライブしました:", subscription);
      // サーバーにサブスクリプション情報を送信
    } catch (error) {
      console.error("Push通知のサブスクリプションに失敗しました:", error);
    }
  }

  share() {
    if ((navigator as any).share) {
      (navigator as any).share({
        title: "PWABuilder pwa-starter",
        text: "Check out the PWABuilder pwa-starter!",
        url: "https://github.com/pwa-builder/pwa-starter",
      });
    }
  }

  render() {
    return html`
      <app-header></app-header>

      <main>
        <div id="welcomeBar">
          <wa-card id="welcomeCard">
            <div slot="header">
              <h2>${this.message}</h2>
            </div>

            <p>
              For more information on the PWABuilder pwa-starter, check out the
              <a href="https://docs.pwabuilder.com/#/starter/quick-start"> documentation</a>.
            </p>

            <p id="mainInfo">
              Welcome to the
              <a href="https://pwabuilder.com">PWABuilder</a>
              pwa-starter! Be sure to head back to
              <a href="https://pwabuilder.com">PWABuilder</a>
              when you are ready to ship this PWA to the Microsoft Store, Google Play and the Apple
              App Store!
            </p>

            ${"share" in navigator
              ? html`<wa-button slot="footer" variant="default" @click="${() => this.share()}">
                  <wa-icon slot="prefix" name="share"></wa-icon>
                  Share this Starter!
                </wa-button>`
              : null}

            <wa-button id="installButton" variant="default">Install PWA</wa-button>
            <wa-button id="allowNotificationsButton" variant="default"
              >Allow Notifications</wa-button
            >
          </wa-card>

          <wa-card id="infoCard">
            <h2>Technology Used</h2>

            <ul>
              <li>
                <a href="https://lit.dev">lit</a>
              </li>

              <li>
                <a href="https://webawesome.com/">Web Awesome</a>
              </li>

              <li>
                <a href="https://github.com/thepassle/app-tools/blob/master/router/README.md"
                  >App Tools Router</a
                >
              </li>
            </ul>
          </wa-card>

          <wa-button href="${resolveRouterPath("about")}" variant="primary"
            >Navigate to About</wa-button
          >
        </div>
      </main>
    `;
  }
}
