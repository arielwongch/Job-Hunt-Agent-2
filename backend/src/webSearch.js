export async function searchWeb(query, limit = 5) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const response = await fetch(url, { headers: { "User-Agent": "job-hunt-agent/1.0" } });
  if (!response.ok) throw new Error(`Web search failed (${response.status})`);
  const data = await response.json();
  const results = [];

  if (data.AbstractText) {
    results.push({ title: data.Heading || query, url: data.AbstractURL, snippet: data.AbstractText });
  }
  for (const topic of data.RelatedTopics || []) {
    if (topic.Text && topic.FirstURL) results.push({ title: topic.Text.split(" - ")[0], url: topic.FirstURL, snippet: topic.Text });
    if (results.length >= limit) break;
  }
  return results.slice(0, limit);
}
