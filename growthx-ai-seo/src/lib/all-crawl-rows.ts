/** Audit summaries need the complete crawl, not the first API page. */
export async function allCrawlRows<T, M extends {totalPages:number}>(read: (page:number)=>Promise<{data:T[];meta:M}>) {
  const first = await read(1);
  const data = [...first.data];
  for (let page = 2; page <= first.meta.totalPages; page += 4) {
    const batch = await Promise.all(Array.from({length:Math.min(4, first.meta.totalPages-page+1)},(_,i)=>read(page+i)));
    for (const result of batch) data.push(...result.data);
  }
  return {...first,data};
}
