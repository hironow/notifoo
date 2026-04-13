import { LitElement, css } from "lit";
import { customElement } from "lit/decorators.js";

import "./pages/app-home";
import "./components/header";
import "./styles/global.css";
import { router } from "./router";

@customElement("app-index")
export class AppIndex extends LitElement {
  static styles = css`
    main {
      padding-left: 16px;
      padding-right: 16px;
      padding-bottom: 16px;
    }
  `;

  firstUpdated() {
    router.addEventListener("route-changed", () => {
      if ("startViewTransition" in document) {
        (document as any).startViewTransition(() => this.requestUpdate());
      } else {
        this.requestUpdate();
      }
    });

    // SW アップデート検知: 既存 SW から新 SW への切り替え時のみリロード
    // 初回インストール時（controller が null → 非 null）はリロード不要
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }
  }

  render() {
    // router config can be round in src/router.ts
    return router.render();
  }
}
