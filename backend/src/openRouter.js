const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterClient {
  constructor({ apiKey, model = "openai/gpt-4o-mini", siteUrl, appName } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.siteUrl = siteUrl;
    this.appName = appName;
  }

  async chat(messages, tools = []) {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json"
    };
    if (this.siteUrl) headers["HTTP-Referer"] = this.siteUrl;
    if (this.appName) headers["X-Title"] = this.appName;

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
        ...(tools.length ? { tools, tool_choice: "auto" } : {})
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter request failed (${response.status}): ${body.slice(0, 500)}`);
    }

    const payload = await response.json();
    return payload.choices?.[0]?.message;
  }
}
