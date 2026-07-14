import { AsciiPointCloud } from "./ascii-point-cloud.js";

const LEGACY_DEFAULT_SOURCE = new URL("../examples/university-of-haifa-old.json", import.meta.url).href;

class HaifaLogoAscii extends AsciiPointCloud {
  connectedCallback() {
    if (!this.hasAttribute("src")) this.setAttribute("src", LEGACY_DEFAULT_SOURCE);
    super.connectedCallback();
  }
}

if (!customElements.get("haifa-logo-ascii")) {
  customElements.define("haifa-logo-ascii", HaifaLogoAscii);
}

export { HaifaLogoAscii };
