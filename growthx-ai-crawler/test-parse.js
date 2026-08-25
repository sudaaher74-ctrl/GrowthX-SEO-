function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    return JSON.parse(candidate);
  } catch (err) {
    console.error("Parse error:", err.message);
    console.error("Candidate was:", candidate);
    return {};
  }
}

parseJson('```json\n{"summary": "Test"}\n```');
