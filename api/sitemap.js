import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const site = 'https://kaamvori.vercel.app'
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  const urls = [
    { loc: ${site}/, changefreq: 'daily', priority: '1.0' },
  ]

  try {
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
      const { data, error } = await supabase
        .from('ladder_jobs')
        .select('id, updated_at, published_at, created_at')
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .limit(5000)
      if (!error && Array.isArray(data)) {
        for (const job of data) {
          const last = (job.updated_at || job.published_at || job.created_at || '').slice(0, 10)
          urls.push({
            loc: ${site}/jobs/,
            lastmod: last || undefined,
            changefreq: 'daily',
            priority: '0.8',
          })
        }
      }
    }
  } catch {
    // fall back to base sitemap
  }

  const body =
    <?xml version="1.0" encoding="UTF-8"?>\n +
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n +
    urls
      .map(
        (u) =>
            <url>\n +
              <loc></loc>\n +
          (u.lastmod ?     <lastmod></lastmod>\n : '') +
          (u.changefreq ?     <changefreq></changefreq>\n : '') +
          (u.priority ?     <priority></priority>\n : '') +
            </url>,
      )
      .join('\n') +
    \n</urlset>\n

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
  res.status(200).send(body)
}
