const multer = require('multer');

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 }
});

const uploadImage = (req, res, next) => parser.single('image')(req, res, (error) => {
  if (!error) return next();
  const tooLarge = error.code === 'LIMIT_FILE_SIZE';
  return res.status(tooLarge ? 413 : 400).json({
    success: false,
    message: tooLarge ? 'Ảnh không được vượt quá 5 MB.' : 'Không nhận được tệp ảnh hợp lệ.'
  });
});

module.exports = uploadImage;
