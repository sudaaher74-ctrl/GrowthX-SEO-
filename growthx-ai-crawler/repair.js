function parseJsonWithFallback(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  
  if (!candidate && text.includes('{')) {
      candidate = text.slice(text.indexOf('{')); // Take everything from the first {
  }

  try {
    return JSON.parse(candidate);
  } catch (err) {
    // Attempt basic truncation repair
    const attempts = [
      candidate + '}',
      candidate + ']}',
      candidate + '}]}',
      candidate + '"]}',
      candidate.replace(/,[^,]*$/, '') + ']}', // strip dangling comma/property
      candidate.replace(/,[^,]*$/, '') + '}]}'
    ];
    
    for (const attempt of attempts) {
      try { return JSON.parse(attempt); } catch(e) {}
    }
    
    throw new Error(`The model produced an invalid JSON response. Raw: ${text.slice(0, 100)}...`);
  }
}

console.log(parseJsonWithFallback('{\n"summary": "Hello",\n"confidence": "low",\n"verifiedClaims": [\n{\n"claim": "Test",\n"date'));
