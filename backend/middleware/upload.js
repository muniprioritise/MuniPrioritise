const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// diskStorage doesn't create its destination folder — without this, a fresh
// clone or fresh deploy (uploads/ is .gitignored, so it won't exist yet)
// fails every upload with ENOENT the first time.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Absolute path, resolved relative to this file's own location, so it
    // always matches wherever index.js serves /uploads from (app.use('/uploads',
    // express.static(path.join(__dirname, 'uploads')))) regardless of the
    // directory the process was started from.
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, WEBP, or HEIC images are allowed'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

module.exports = upload;
