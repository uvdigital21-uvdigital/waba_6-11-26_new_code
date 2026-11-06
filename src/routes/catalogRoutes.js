import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  getCatalogStats,
  getCatalogs,
  getCatalogById,
  createCatalog,
  updateCatalog,
  duplicateCatalog,
  deleteCatalog,
  uploadCatalogImage
} from '../controllers/catalogController.js';

const router = express.Router();

// Ensure upload directory exists
const catalogUploadDir = path.join(process.cwd(), 'uploads', 'catalogs');
if (!fs.existsSync(catalogUploadDir)) {
  fs.mkdirSync(catalogUploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, catalogUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'catalog-img-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/svg+xml'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WEBP, SVG) are allowed'));
    }
  }
});

// Protect all catalog endpoints with authentication
router.use(requireAuth);

// Stats endpoint (must be before /:id to avoid route collision)
router.get('/stats', asyncHandler(getCatalogStats));

// Image upload (must be before /:id)
router.post('/upload-image', upload.single('image'), asyncHandler(uploadCatalogImage));

router.get('/', asyncHandler(getCatalogs));
router.get('/:id', asyncHandler(getCatalogById));
router.post('/', asyncHandler(createCatalog));
router.put('/:id', asyncHandler(updateCatalog));
router.post('/:id/duplicate', asyncHandler(duplicateCatalog));
router.delete('/:id', asyncHandler(deleteCatalog));

export default router;
