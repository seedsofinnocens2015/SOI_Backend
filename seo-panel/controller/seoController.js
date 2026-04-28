const Seo = require('../model/Seo');

const SEO_FIELDS = [
  'pageTitle',
  'metaKeyword',
  'metaDescription',
  'newsKeywords',
  'abstract',
  'dcSource',
  'dcTitle',
  'dcKeywords',
  'dcDescription',
  'canonical',
  'alternate',
  'robot',
  'copyright',
  'author',
  'ogLocale',
  'ogType',
  'ogTitle',
  'ogDescription',
  'ogUrl',
  'ogSiteName',
  'ogImage',
  'fbAdmins',
  'twitterCard',
  'twitterSite',
  'twitterCreator',
  'twitterTitle',
  'twitterDescription',
  'twitterImageSrc',
  'twitterCanonical',
  'itemType',
  'itemName',
  'itemDescription',
  'itemUrl',
  'itemImage',
  'itemAuthor',
  'itemOrganization',
];

const normalizePageUrl = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed === '/' || trimmed === 'common') return trimmed;

  // Keep route keys consistent across clients, regardless of trailing slash usage.
  return trimmed.replace(/\/+$/, '');
};

const getPageUrlCandidates = pageUrl => {
  if (!pageUrl || pageUrl === '/' || pageUrl === 'common') return [pageUrl];
  return Array.from(new Set([pageUrl, `${pageUrl}/`]));
};

const getDefaultSeo = (pageUrl = '') => {
  const defaults = { pageUrl };
  SEO_FIELDS.forEach(field => {
    defaults[field] = '';
  });
  return defaults;
};

const normalizeSeoPayload = payload => {
  const normalizedPayload = {};
  SEO_FIELDS.forEach(field => {
    normalizedPayload[field] = payload[field] ?? '';
  });

  return {
    pageUrl: payload.pageUrl,
    ...normalizedPayload,
  };
};

const saveSeo = async (req, res) => {
  try {
    const pageUrl = normalizePageUrl(req.body.pageUrl);

    if (!pageUrl) {
      console.error('[SEO][saveSeo] Missing pageUrl in request body');
      return res.status(400).json({ ok: false, error: 'pageUrl is required' });
    }

    console.log(`[SEO][saveSeo] Incoming payload for pageUrl: ${pageUrl}`, req.body);
    const normalizedPayload = normalizeSeoPayload({ ...req.body, pageUrl });
    const pageUrlCandidates = getPageUrlCandidates(pageUrl).filter(Boolean);

    console.log(`[SEO][saveSeo] Upserting SEO for pageUrl: ${pageUrl}`);
    const existingSeo = await Seo.findOne({
      pageUrl: { $in: pageUrlCandidates },
    });

    const seo = existingSeo
      ? await Seo.findByIdAndUpdate(existingSeo._id, normalizedPayload, {
          new: true,
          runValidators: true,
        })
      : await Seo.findOneAndUpdate({ pageUrl }, normalizedPayload, {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
          runValidators: true,
        });

    console.log(`[SEO][saveSeo] Upsert successful for pageUrl: ${pageUrl}`);
    return res.status(200).json({ ok: true, data: seo });
  } catch (error) {
    console.error('[SEO][saveSeo] Error saving SEO', error);
    if (error && error.code === 11000) {
      return res.status(409).json({ ok: false, error: 'Duplicate pageUrl not allowed' });
    }
    return res.status(500).json({ ok: false, error: 'Failed to save SEO data' });
  }
};

const getSeo = async (req, res) => {
  try {
    const requestedPageUrl = req.query.pageUrl || '/';
    const pageUrl = normalizePageUrl(requestedPageUrl) || '/';
    const pageUrlCandidates = getPageUrlCandidates(pageUrl).filter(Boolean);
    console.log(`[SEO][getSeo] Fetching SEO for pageUrl: ${pageUrl}`);

    const seo = await Seo.findOne({ pageUrl: { $in: pageUrlCandidates } }).lean();
    if (seo) {
      console.log(`[SEO][getSeo] SEO found for pageUrl: ${pageUrl}`);
      return res.status(200).json({ ok: true, data: seo });
    }

    console.log(`[SEO][getSeo] No SEO found, returning defaults for: ${pageUrl}`);
    return res.status(200).json({ ok: true, data: getDefaultSeo(pageUrl) });
  } catch (error) {
    console.error('[SEO][getSeo] Error fetching SEO', error);
    return res.status(500).json({ ok: false, error: 'Failed to fetch SEO data' });
  }
};

module.exports = {
  saveSeo,
  getSeo,
};
