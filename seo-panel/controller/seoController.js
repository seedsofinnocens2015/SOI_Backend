const mongoose = require('mongoose');
const { getSeoModel, buildCollectionName } = require('../model/Seo');

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
    hierarchyPath: Array.isArray(payload.hierarchyPath) ? payload.hierarchyPath : [],
    ...normalizedPayload,
  };
};

const normalizeHierarchyPath = value => {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => String(item || '').trim())
          .filter(Boolean);
      }
    } catch (_error) {
      return value
        .split('>')
        .map(item => String(item || '').trim())
        .filter(Boolean);
    }
  }

  return [];
};

const isSeoPageCollection = collectionName => {
  const excludedCollections = new Set(['seo_users', 'seo_auth_otps']);
  return collectionName.startsWith('seo_') && !excludedCollections.has(collectionName);
};

const hasAnySeoValue = seoDocument => {
  return SEO_FIELDS.some(field => String(seoDocument?.[field] ?? '').trim() !== '');
};

const saveSeo = async (req, res) => {
  try {
    const pageUrl = normalizePageUrl(req.body.pageUrl);
    const hierarchyPath = normalizeHierarchyPath(req.body.hierarchyPath);
    const Seo = getSeoModel(hierarchyPath);
    const collectionName = buildCollectionName(hierarchyPath);

    if (!pageUrl) {
      console.error('[SEO][saveSeo] Missing pageUrl in request body');
      return res.status(400).json({ ok: false, error: 'pageUrl is required' });
    }

    // console.log(`[SEO][saveSeo] Incoming payload for pageUrl: ${pageUrl} in collection: ${collectionName}`, req.body);

    const normalizedPayload = normalizeSeoPayload({ ...req.body, pageUrl, hierarchyPath });
    const pageUrlCandidates = getPageUrlCandidates(pageUrl).filter(Boolean);

    // console.log(`[SEO][saveSeo] Upserting SEO for pageUrl: ${pageUrl} in collection: ${collectionName}`);
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

    // console.log(`[SEO][saveSeo] Upsert successful for pageUrl: ${pageUrl} in collection: ${collectionName}`);
    return res.status(200).json({ ok: true, data: seo, collection: collectionName });
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
    const hierarchyPath = normalizeHierarchyPath(req.query.hierarchyPath || []);
    const Seo = getSeoModel(hierarchyPath);
    const collectionName = buildCollectionName(hierarchyPath);
    const pageUrlCandidates = getPageUrlCandidates(pageUrl).filter(Boolean);
    // console.log(`[SEO][getSeo] Fetching SEO for pageUrl: ${pageUrl} from collection: ${collectionName}`);

    const seo = await Seo.findOne({ pageUrl: { $in: pageUrlCandidates } }).lean();
    if (seo) {
      // console.log(`[SEO][getSeo] SEO found for pageUrl: ${pageUrl} in collection: ${collectionName}`);
      return res.status(200).json({ ok: true, data: seo, collection: collectionName });
    }

    // console.log(`[SEO][getSeo] No SEO found, returning defaults for: ${pageUrl} in collection: ${collectionName}`);
    return res.status(200).json({
      ok: true,
      data: { ...getDefaultSeo(pageUrl), hierarchyPath },
      collection: collectionName,
    });
  } catch (error) {
    console.error('[SEO][getSeo] Error fetching SEO', error);
    return res.status(500).json({ ok: false, error: 'Failed to fetch SEO data' });
  }
};

const getSeoStats = async (req, res) => {
  try {
    const parsedPageUrls = (() => {
      const value = req.query.pageUrls;
      if (!value) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_error) {
        return [];
      }
    })();

    const normalizedPageUrls = Array.from(
      new Set(
        parsedPageUrls
          .map(normalizePageUrl)
          .filter(Boolean)
      )
    );

    if (!normalizedPageUrls.length) {
      return res.status(200).json({
        ok: true,
        data: { updatedCount: 0, totalCount: 0, notUpdatedCount: 0, updatedPageUrls: [], notUpdatedPageUrls: [] },
      });
    }

    const pageUrlCandidates = Array.from(
      new Set(
        normalizedPageUrls.flatMap(pageUrl => getPageUrlCandidates(pageUrl).filter(Boolean))
      )
    );

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ ok: false, error: 'Database is not connected' });
    }

    const collectionMetadata = await db.listCollections({}, { nameOnly: true }).toArray();
    const seoCollectionNames = collectionMetadata
      .map(item => item.name)
      .filter(isSeoPageCollection);

    const updatedPageUrls = new Set();
    for (const collectionName of seoCollectionNames) {
      const rows = await db
        .collection(collectionName)
        .find({ pageUrl: { $in: pageUrlCandidates } })
        .project({ pageUrl: 1, ...Object.fromEntries(SEO_FIELDS.map(field => [field, 1])) })
        .toArray();

      rows.forEach(row => {
        const normalized = normalizePageUrl(row.pageUrl);
        if (normalized && normalizedPageUrls.includes(normalized) && hasAnySeoValue(row)) {
          updatedPageUrls.add(normalized);
        }
      });
    }

    const totalCount = normalizedPageUrls.length;
    const updatedCount = updatedPageUrls.size;
    const notUpdatedCount = Math.max(0, totalCount - updatedCount);
    const updatedPageUrlsList = normalizedPageUrls.filter(pageUrl => updatedPageUrls.has(pageUrl));
    const notUpdatedPageUrlsList = normalizedPageUrls.filter(pageUrl => !updatedPageUrls.has(pageUrl));

    return res.status(200).json({
      ok: true,
      data: {
        updatedCount,
        totalCount,
        notUpdatedCount,
        updatedPageUrls: updatedPageUrlsList,
        notUpdatedPageUrls: notUpdatedPageUrlsList,
      },
    });
  } catch (error) {
    console.error('[SEO][getSeoStats] Error fetching SEO stats', error);
    return res.status(500).json({ ok: false, error: 'Failed to fetch SEO stats' });
  }
};

module.exports = {
  saveSeo,
  getSeo,
  getSeoStats,
};

