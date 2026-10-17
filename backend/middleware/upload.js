const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');

// Photos go to Cloudinary when CLOUDINARY_URL is set (Render). Render's disk is
// wiped on every redeploy and restart, so files written there do not last.
// Without CLOUDINARY_URL (local development) photos are written to
// backend/uploads and served from /uploads, as before.

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const err = new Error('Only JPEG, PNG, WEBP, or HEIC images are allowed');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err);
  }
  cb(null, true);
}

// Files are held in memory first (at most 5 x 5MB per request), then stored.
const parser = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

function useCloudinary() {
  return Boolean(process.env.CLOUDINARY_URL);
}

function saveToCloudinary(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        // Deliver as a JPEG so a phone's HEIC photo also shows in a browser.
        resolve(
          cloudinary.url(result.public_id, {
            version: result.version,
            format: 'jpg',
            quality: 'auto',
            urlAnalytics: false,
            secure: true,
          })
        );
      }
    );
    stream.end(file.buffer);
  });
}

function saveToDisk(file) {
  // diskStorage would create this folder; memoryStorage does not, and uploads/
  // is .gitignored, so it will not exist on a fresh clone.
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
  return `/uploads/${filename}`;
}

// Sets file.url on every uploaded file: a full https URL on Cloudinary, or a
// /uploads/... path on local disk.
function store(folder) {
  return async (req, res, next) => {
    try {
      const files = req.files || [];
      await Promise.all(
        files.map(async (file) => {
          file.url = useCloudinary() ? await saveToCloudinary(file, folder) : saveToDisk(file);
        })
      );
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Drop-in for multer's upload.array(field, max): returns two middleware
// functions, which Express accepts in place of one.
module.exports = {
  array(field, max) {
    return [parser.array(field, max), store(`muniprioritise/${field}`)];
  },
};