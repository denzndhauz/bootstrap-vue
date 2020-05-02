// Custom post `html-loader` loader that parses HTML into:
// - titleLead (title + lead paragrpah)
// - body (everything after the lead paragraph
// - baseTOC (base Table of Contents object parsed from the README)

// --- Utility methods and constants ---

// Remove any HTML tags, but leave entities alone
const RX_HTML_TAGS = /<[^>]+>/g
const stripHTML = (str = '') => str.replace(RX_HTML_TAGS, '')

// Remove any double quotes from a string
const RX_QUOTES = /"/g
const stripQuotes = (str = '') => str.replace(RX_QUOTES, '')

// Splits an HTML README into two parts: Title+Lead and Body
// So that we can place ads after the lead section
const RX_TITLE_LEAD_BODY = /^\s*(<h1 .+?<\/h1>)\s*(<p class="?bd-lead[\s\S]+?<\/p>)?([\s\S]*)$/i
const parseReadme = readme => {
  const parts = (readme || '').match(RX_TITLE_LEAD_BODY) || []
  const title = parts[1] || ''
  const lead = parts[2] || ''
  const body = parts[3] || ''
  const hasTitleLead = title || lead
  return {
    titleLead: (hasTitleLead ? `${title} ${lead}` : '').trim(),
    body: (hasTitleLead ? body : readme || '').trim()
  }
}

// Generate a base TOC structure from Readme HTML
const RX_HEADING_H1 = /<h1 id="?([^>" ]+)"?[^>]*>(.+?)<\/h1>/
const RX_ALL_HEADING_H2H3 = /<h([23]) id=[^> ]+[^>]*>.+?<\/h\1>/g
const RX_HEADING_H2H3 = /^<(h[23]) id="?([^> ]+)"?[^>]*>(.+?)<\/\1>$/
const makeBaseTOC = readme => {
  if (!readme) {
    return {}
  }

  let top = ''
  let title = ''
  const toc = []
  let parentIdx = 0

  // Get the first <h1> tag with ID
  const h1 = readme.match(RX_HEADING_H1) || []
  if (h1) {
    top = `#${stripQuotes(h1[1])}`
    title = stripHTML(h1[2])
  }

  // Get all the <h2> and <h3> headings with ID's
  const headings = readme.match(RX_ALL_HEADING_H2H3) || []

  // Process the <h2> and <h3> headings into a TOC structure
  headings
    // Create a match `[value, tag, id, content]`
    .map(heading => heading.match(RX_HEADING_H2H3))
    // Filter out un-matched values
    .filter(v => Array.isArray(v))
    // Create TOC structure
    .forEach(([, tag, id, content]) => {
      const href = `#${stripQuotes(id)}`
      const label = stripHTML(content)
      if (tag === 'h2') {
        toc.push({ href, label })
        parentIdx = toc.length - 1
      } else if (tag === 'h3') {
        const parent = toc[parentIdx]
        if (parent) {
          // We nest <h3> tags as a sub array
          parent.toc = parent.toc || []
          parent.toc.push({ href, label })
        }
      }
    })

  return { top, title, toc }
}

// --- docs-loader export ---
const RX_NO_TRANSLATE = /<(kbd|code|samp)>/gi
module.exports = function(html) {
  // Make results cacheable
  this.cacheable()
  // If we place html-loader before this loader, we need to
  // eval the output first and extract module.exports
  try {
    /* eslint-disable prefer-const */
    // the eval will populate module.exports
    let module = {}
    /* eslint-enable prefer-const */
    /* eslint-disable no-eval */
    eval(html)
    /* eslint-enable no-eval */
    html = module.exports || ''
  } catch {}
  html = html || ''
  // Mark certain elements as translate="no"
  html.replace(RX_NO_TRANSLATE, '<$1 class="notranslate" translate="no">')
  // Parse the README into its sections
  const { titleLead, body } = parseReadme(html)
  // Build the base TOC for the page
  const baseTOC = makeBaseTOC(html)
  // Return a stringified object with the parsed bits
  return `module.exports = ${JSON.stringify({ baseTOC, titleLead, body })}`
}