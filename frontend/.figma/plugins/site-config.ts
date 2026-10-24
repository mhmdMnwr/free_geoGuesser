import type { HtmlTagDescriptor, Plugin } from "vite"

export type FigmaSiteConfiguration = {
  title?: string
  description?: string
  language?: string
  robots?: { index?: boolean }
  icons?: { icon?: string }
  openGraph?: { image?: string }
  analytics?: { googleAnalyticsId?: string }
  customScripts?: {
    headStart?: string
    headEnd?: string
    bodyStart?: string
    bodyEnd?: string
  }
  accessibility?: { addBypassLinks?: boolean }
}

const BYPASS_LINK_CSS = `
  .figma-bypass-link {
    position: fixed; top: 8px; left: 8px; z-index: 2147483647;
    transform: translateY(-150%); border-radius: 6px;
    background: #111827; color: #fff; padding: 8px 12px;
    font: 600 14px/1.2 system-ui, sans-serif; text-decoration: none;
  }
  .figma-bypass-link:focus { transform: translateY(0); }
`

function sanitizeHtmlValue(value: string | undefined): string {
  return value?.replace(/[^a-zA-Z0-9_-]/g, "") || ""
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Applies /.figma/make/site.json to the generated document shell. */
export function figmaSiteConfiguration(config: FigmaSiteConfiguration): Plugin {
  const title = config.title ?? "Figma Make App"
  const description = config.description ?? ""
  const favicon = config.icons?.icon ?? "/favicon.svg"
  const socialImage = config.openGraph?.image ?? ""
  const language = sanitizeHtmlValue(config.language) || "en"
  const gaId = sanitizeHtmlValue(config.analytics?.googleAnalyticsId)
  const robotsTxt = config.robots?.index === false ? "User-agent: *\nDisallow: /\n" : ""

  return {
    name: "figma-site-configuration",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!robotsTxt || req.url?.split("?")[0] !== "/robots.txt") return next()
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
        res.end(robotsTxt)
      })
    },
    generateBundle() {
      if (robotsTxt) {
        this.emitFile({ type: "asset", fileName: "robots.txt", source: robotsTxt })
      }
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const slots: Record<string, string> = {
          "figma:lang": language,
          "figma:title": escapeHtmlText(title),
          "figma:head-start": config.customScripts?.headStart ?? "",
          "figma:head-end": config.customScripts?.headEnd ?? "",
          "figma:body-start": config.customScripts?.bodyStart ?? "",
          "figma:body-end": config.customScripts?.bodyEnd ?? "",
        }
        let result = html
        for (const [slot, val] of Object.entries(slots)) {
          result = result.replace(`<!-- ${slot} -->`, val)
        }

        const tags: HtmlTagDescriptor[] = []
        if (description) {
          tags.push({ tag: "meta", attrs: { name: "description", content: description }, injectTo: "head" })
          tags.push({ tag: "meta", attrs: { property: "og:description", content: description }, injectTo: "head" })
        }
        if (config.robots?.index === false) {
          tags.push({ tag: "meta", attrs: { name: "robots", content: "noindex, nofollow" }, injectTo: "head" })
        }
        if (favicon) {
          tags.push({ tag: "link", attrs: { rel: "icon", href: favicon }, injectTo: "head" })
        }
        if (title) {
          tags.push({ tag: "meta", attrs: { property: "og:title", content: title }, injectTo: "head" })
        }
        if (socialImage) {
          tags.push(
            { tag: "meta", attrs: { property: "og:image", content: socialImage }, injectTo: "head" },
            { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" }, injectTo: "head" },
            { tag: "meta", attrs: { name: "twitter:image", content: socialImage }, injectTo: "head" },
          )
        }
        if (gaId) {
          tags.push(
            { tag: "script", attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${gaId}` }, injectTo: "head" },
            { tag: "script", children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(gaId)});`, injectTo: "head" },
          )
        }
        if (config.accessibility?.addBypassLinks) {
          tags.push(
            { tag: "style", children: BYPASS_LINK_CSS, injectTo: "head" },
            { tag: "a", attrs: { class: "figma-bypass-link", href: "#root" }, children: "Skip to content", injectTo: "body-prepend" },
          )
        }
        return { html: result, tags }
      },
    },
  }
}
