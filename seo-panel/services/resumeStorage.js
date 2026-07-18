const crypto = require('crypto');
const path = require('path');
const { configureCloudinary } = require('../../config/cloudinary');

const DELIVERY_TYPE = 'authenticated';
const RESOURCE_TYPE = 'raw';
const RESUME_FOLDER = 'soi/job-applications/resumes';

function safeFilePart(value) {
  return String(value || 'resume')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'resume';
}

function uploadResume(file, applicantName) {
  const cloudinary = configureCloudinary();
  const extension = path.extname(file.originalname || '').toLowerCase();
  const publicId = `${RESUME_FOLDER}/${Date.now()}-${crypto.randomUUID()}-${safeFilePart(applicantName)}${extension}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: RESOURCE_TYPE,
        type: DELIVERY_TYPE,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve({
          publicId: result.public_id,
          version: result.version,
          resourceType: result.resource_type || RESOURCE_TYPE,
          deliveryType: result.type || DELIVERY_TYPE,
          secureUrl: result.secure_url,
          assetId: result.asset_id,
        });
      }
    );

    stream.end(file.buffer);
  });
}

async function deleteResume(resume) {
  if (!resume?.cloudinaryPublicId) return;
  const cloudinary = configureCloudinary();
  await cloudinary.uploader.destroy(resume.cloudinaryPublicId, {
    resource_type: resume.cloudinaryResourceType || RESOURCE_TYPE,
    type: resume.cloudinaryDeliveryType || DELIVERY_TYPE,
    invalidate: true,
  });
}

function getSignedResumeUrl(resume) {
  const cloudinary = configureCloudinary();
  const format = path.extname(resume.originalName || resume.cloudinaryPublicId || '')
    .replace(/^\./, '')
    .toLowerCase();
  return cloudinary.utils.private_download_url(resume.cloudinaryPublicId, format, {
    resource_type: resume.cloudinaryResourceType || RESOURCE_TYPE,
    type: resume.cloudinaryDeliveryType || DELIVERY_TYPE,
    expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
    attachment: true,
  });
}

module.exports = { deleteResume, getSignedResumeUrl, uploadResume };
